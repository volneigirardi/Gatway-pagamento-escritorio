import {
  Kysely,
  PostgresDialect,
  sql,
  type Generated,
  type Selectable,
  type Insertable,
  type Transaction,
  type Updateable,
} from "kysely";
import pg from "pg";
import { getChildLogger, type Logger } from "@saas/observability";

export interface Database {
  kysely_migration: { name: string; migration_timestamp: Date | null };
  kysely_migration_lock: { id: number; is_locked: number };
  outbox: {
    id: string;
    tenant_id: string;
    aggregate_type: string;
    aggregate_id: string;
    type: string;
    event_version: Generated<string>;
    payload: string;
    metadata: string;
    created_at: string;
    processed_at: string | null;
  };
}

export type Row<T extends keyof Database> = Selectable<Database[T]>;
export type NewRow<T extends keyof Database> = Insertable<Database[T]>;
export type UpdateRow<T extends keyof Database> = Updateable<Database[T]>;

export interface ConnectionConfig {
  connectionString: string;
  poolMin?: number;
  poolMax?: number;
  queryTimeout?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  logger?: Logger;
}

export function createKysely<DB = Database>(
  config: ConnectionConfig,
): Kysely<DB> {
  const logger = config.logger ? getChildLogger(config.logger) : undefined;
  const pool = new pg.Pool({
    connectionString: config.connectionString,
    min: config.poolMin ?? 2,
    max: config.poolMax ?? 10,
    query_timeout: config.queryTimeout ?? 30000,
    statement_timeout: config.queryTimeout ?? 30000,
    idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 2000,
  });

  pool.on("error", (err) => {
    logger?.error({ err }, "PostgreSQL pool error");
  });

  const dialect = new PostgresDialect({ pool });
  return new Kysely<DB>({
    dialect,
    log(event) {
      if (event.level === "error") {
        logger?.error(
          { query: event.query.sql, error: event.error },
          "PostgreSQL query error",
        );
      }
    },
  });
}

export async function closeKysely<DB>(db: Kysely<DB>): Promise<void> {
  await db.destroy();
}

export async function withTransaction<DB, T>(
  db: Kysely<DB>,
  callback: (trx: Transaction<DB>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(callback);
}

export async function withTenantTransaction<DB, T>(
  db: Kysely<DB>,
  tenantId: string,
  callback: (trx: Transaction<DB>) => Promise<T>,
): Promise<T> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      tenantId,
    )
  ) {
    throw new Error("tenantId must be a valid UUID");
  }

  return db.transaction().execute(async (trx) => {
    await sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`.execute(
      trx,
    );
    return callback(trx);
  });
}

export * from "./roles.js";
