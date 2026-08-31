import { type Kysely, sql } from "kysely";

const schemaName = "qa_";
const embeddingsTable = `${schemaName}.embeddings`;
const fingerprintsTable = `${schemaName}.fingerprints`;
const auditLogTable = `${schemaName}.audit_log`;

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable(embeddingsTable)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("memory_item_id", "uuid", (col) =>
      col
        .notNull()
        .references(`${schemaName}.memory_items.id`)
        .onDelete("cascade"),
    )
    .addColumn("model", "varchar(255)", (col) => col.notNull())
    .addColumn("dimensions", "integer", (col) => col.notNull())
    .addColumn("vector_jsonb", "jsonb", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_qa_embeddings_memory_item")
    .on(embeddingsTable)
    .column("memory_item_id")
    .execute();

  const extensionResult = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) AS exists
  `.execute(db);

  if (extensionResult.rows[0]?.exists) {
    await sql`
      ALTER TABLE ${sql.ref(embeddingsTable)}
      ADD COLUMN IF NOT EXISTS vector vector(1536)
    `.execute(db);

    await sql`
      CREATE INDEX IF NOT EXISTS idx_qa_embeddings_vector
      ON ${sql.ref(embeddingsTable)} USING ivfflat (vector vector_cosine_ops)
      WHERE vector IS NOT NULL
    `.execute(db);
  }

  await db.schema
    .createTable(fingerprintsTable)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("change_id", "varchar(255)")
    .addColumn("source_sha", "varchar(40)", (col) => col.notNull())
    .addColumn("lockfile_hash", "varchar(64)")
    .addColumn("migration_hash", "varchar(64)")
    .addColumn("config_hash", "varchar(64)")
    .addColumn("test_version", "varchar(100)")
    .addColumn("fixture_hash", "varchar(64)")
    .addColumn("env_fingerprint", "varchar(255)")
    .addColumn("browser", "varchar(255)")
    .addColumn("affected_closure", "jsonb")
    .addColumn("result_status", "varchar(50)", (col) => col.notNull())
    .addColumn("result_id", "uuid")
    .addColumn("expires_at", "timestamptz")
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_qa_fingerprints_valid
    ON ${sql.ref(fingerprintsTable)} (
      source_sha, lockfile_hash, migration_hash, config_hash,
      test_version, fixture_hash, env_fingerprint, browser, result_status
    )
    WHERE expires_at IS NULL
  `.execute(db);

  await db.schema
    .createTable(auditLogTable)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("operation", "varchar(50)", (col) => col.notNull())
    .addColumn("table_name", "varchar(255)", (col) => col.notNull())
    .addColumn("record_id", "uuid")
    .addColumn("actor", "varchar(255)")
    .addColumn("change_summary", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_qa_audit_log_table_record")
    .on(auditLogTable)
    .columns(["table_name", "record_id"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(auditLogTable).ifExists().execute();
  await db.schema.dropTable(fingerprintsTable).ifExists().execute();
  await db.schema.dropTable(embeddingsTable).ifExists().execute();
}
