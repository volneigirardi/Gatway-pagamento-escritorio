import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Kysely, PostgresDialect } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import pg from "pg";

export async function runMigrations(connectionString: string): Promise<void> {
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

  const migrationFolder = path.resolve(
    import.meta.dirname,
    "../../../database/migrations/qa",
  );

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
      import: async (filePath): Promise<unknown> =>
        (await import(pathToFileURL(filePath).href)) as unknown,
    }),
  });

  const { error, results } = await migrator.migrateToLatest();
  await db.destroy();

  if (error) {
    throw new Error("QA migration failed", { cause: error });
  }

  results?.forEach((result) => {
    if (result.status === "Error") {
      throw new Error(`Migration failed: ${result.migrationName}`);
    }
  });
}
