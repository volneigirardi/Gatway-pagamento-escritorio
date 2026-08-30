import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Migrator, FileMigrationProvider } from "kysely/migration";
import { hydrateFileEnvironment } from "@saas/config";
import { grantRuntimePrivileges } from "@saas/database";
import pg from "pg";

type Direction = "up" | "down" | "status" | "plan";

/**
 * Derives a stable bigint lock key from the migration target so `tenant`
 * and `admin` migrations never contend, but two concurrent runs against the
 * same target (e.g. a retried Job and a manual run) do.
 */
function lockKeyFor(target: string): bigint {
  const hash = createHash("sha256").update(target).digest();
  return hash.readBigInt64BE(0);
}

async function withMigrationLock<T>(
  db: Kysely<unknown>,
  target: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = lockKeyFor(target);
  const { rows } = await sql<{
    locked: boolean;
  }>`select pg_try_advisory_lock(${key}) as locked`.execute(db);
  if (!rows[0]?.locked) {
    throw new Error(
      `Could not acquire migration lock for target "${target}"; another migration run is likely in progress.`,
    );
  }
  try {
    return await fn();
  } finally {
    await sql`select pg_advisory_unlock(${key})`.execute(db);
  }
}

async function migrate(direction: Direction): Promise<void> {
  hydrateFileEnvironment();
  const target = process.argv[3] ?? "tenant";
  const migrationsFolder = path.resolve(
    import.meta.dirname,
    "..",
    "migrations",
    target,
  );
  const connectionString = process.env["MIGRATION_DATABASE_URL"];
  if (!connectionString) {
    throw new Error("MIGRATION_DATABASE_URL environment variable is required");
  }

  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString,
        max: 1,
        statement_timeout: 60_000,
        lock_timeout: 10_000,
      }),
    }),
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: migrationsFolder,
      import: async (filePath): Promise<unknown> =>
        (await import(pathToFileURL(filePath).href)) as unknown,
    }),
  });

  if (direction === "status" || direction === "plan") {
    const migrations = await migrator.getMigrations();
    if (direction === "plan") {
      const pending = migrations.filter((m) => !m.executedAt);
      console.log(
        pending.length === 0
          ? "No pending migrations."
          : `Pending migrations (${String(pending.length)}):`,
      );
      pending.forEach((m) => {
        console.log(`  - ${m.name}`);
      });
    } else {
      console.table(migrations);
    }
    await db.destroy();
    return;
  }

  await withMigrationLock(db, target, async () => {
    const { error, results } =
      direction === "up"
        ? await migrator.migrateToLatest()
        : await migrator.migrateDown();

    results?.forEach((result) => {
      if (result.status === "Success") {
        console.log(`${direction} succeeded: ${result.migrationName}`);
      } else if (result.status === "Error") {
        console.error(`${direction} failed: ${result.migrationName}`);
      }
    });

    if (error) {
      console.error(error);
      process.exitCode = 1;
      return;
    }

    await grantRuntimePrivileges(db);
  });

  await db.destroy();
}

const direction = (process.argv[2] ?? "up") as Direction;
void migrate(direction);
