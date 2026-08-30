import { type Kysely, sql } from "kysely";

const schemaName = "qa_";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS ${sql.ref(schemaName)}`.execute(db);
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
      ) THEN
        CREATE EXTENSION IF NOT EXISTS vector;
      END IF;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'pgvector extension cannot be created with current role';
    END;
    $$
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP SCHEMA IF EXISTS ${sql.ref(schemaName)} CASCADE`.execute(db);
}
