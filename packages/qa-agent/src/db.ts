import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { QaDatabase } from "./db-schema.js";

export interface QaDbConfig {
  connectionString: string;
  poolMin?: number;
  poolMax?: number;
  queryTimeout?: number;
}

export function createQaDb(config: QaDbConfig): Kysely<QaDatabase> {
  const pool = new pg.Pool({
    connectionString: config.connectionString,
    min: config.poolMin ?? 1,
    max: config.poolMax ?? 5,
    query_timeout: config.queryTimeout ?? 30_000,
    statement_timeout: config.queryTimeout ?? 30_000,
    connectionTimeoutMillis: 2_000,
  });

  pool.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("QA database pool error:", err);
  });

  return new Kysely<QaDatabase>({
    dialect: new PostgresDialect({ pool }),
  });
}

export async function closeQaDb(db: Kysely<QaDatabase>): Promise<void> {
  await db.destroy();
}
