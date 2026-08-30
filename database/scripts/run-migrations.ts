import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Migrator, FileMigrationProvider } from "kysely/migration";
import { hydrateFileEnvironment } from "@saas/config";
import { grantRuntimePrivileges } from "@saas/database";
import pg from "pg";

type Direction = "up" | "down" | "status" | "plan";

/**
 * Acquires a PostgreSQL advisory lock keyed by the migration target so `tenant`
 * and `admin` migrations never contend. The lock key is derived entirely inside
 * PostgreSQL using `hashtextextended` to avoid sending JavaScript `BigInt`
 * through the driver.
 */
async function withMigrationLock<T>(
  db: Kysely<unknown>,
  target: string,
  fn: () => Promise<T>,
): Promise<T> {
  const { rows } = await sql<{
    locked: boolean;
  }>`select pg_try_advisory_lock(hashtextextended(${target}::text, 0::bigint)) as locked`.execute(
    db,
  );
  if (!rows[0]?.locked) {
    throw new Error(
      `Could not acquire migration lock for target "${target}"; another migration run is likely in progress.`,
    );
  }
  try {
    return await fn();
  } finally {
    await sql`select pg_advisory_unlock(hashtextextended(${target}::text, 0::bigint))`.execute(
      db,
    );
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
    migrationTableName: `kysely_migration_${target}`,
    migrationLockTableName: `kysely_migration_lock_${target}`,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: migrationsFolder,
      import: async (filePath): Promise<unknown> =>
        (await import(pathToFileURL(filePath).href)) as unknown,
    }),
  });

  try {
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

      if (direction === "up") {
        await grantRuntimePrivileges(db);
      }
    });
  } finally {
    await db.destroy();
  }
}

const direction = (process.argv[2] ?? "up") as Direction;
void migrate(direction);
