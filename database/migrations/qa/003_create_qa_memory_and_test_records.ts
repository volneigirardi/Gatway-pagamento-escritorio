import { type Kysely, sql } from "kysely";

const schemaName = "qa_";
const memoryItemsTable = `${schemaName}.memory_items`;
const testRunsTable = `${schemaName}.test_runs`;
const testResultsTable = `${schemaName}.test_results`;
const defectsTable = `${schemaName}.defects`;
const fixAttemptsTable = `${schemaName}.fix_attempts`;
const releasesTable = `${schemaName}.releases`;
const releaseGatesTable = `${schemaName}.release_gates`;

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable(memoryItemsTable)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("kind", "varchar(100)", (col) => col.notNull())
    .addColumn("change_id", "varchar(255)")
    .addColumn("source_sha", "varchar(40)")
    .addColumn("scope", "varchar(50)")
    .addColumn("environment", "varchar(50)")
    .addColumn("title", "varchar(500)", (col) => col.notNull())
    .addColumn("content", "text")
    .addColumn("content_hash", "varchar(64)", (col) => col.notNull())
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_qa_memory_items_kind_sha")
    .on(memoryItemsTable)
    .columns(["kind", "source_sha"])
    .execute();

  await db.schema
    .createIndex("uq_qa_memory_items_content_hash_kind")
    .on(memoryItemsTable)
    .columns(["content_hash", "kind"])
    .unique()
    .execute();

  await db.schema
    .createIndex("idx_qa_memory_items_created_at")
    .on(memoryItemsTable)
    .column("created_at")
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_qa_memory_items_metadata
    ON ${sql.ref(memoryItemsTable)} USING gin (metadata jsonb_path_ops)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_qa_memory_items_compact
    ON ${sql.ref(memoryItemsTable)} (updated_at)
    WHERE metadata ->> 'invalidated' = 'true'
  `.execute(db);

  await db.schema
    .createTable(testRunsTable)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("change_id", "varchar(255)")
    .addColumn("source_sha", "varchar(40)", (col) => col.notNull())
    .addColumn("base_sha", "varchar(40)")
    .addColumn("scope", "varchar(50)", (col) => col.notNull())
    .addColumn("environment", "varchar(50)", (col) => col.notNull())
    .addColumn("status", "varchar(50)", (col) => col.notNull())
    .addColumn("duration_ms", "integer")
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_qa_test_runs_sha")
    .on(testRunsTable)
    .column("source_sha")
    .execute();

  await db.schema
    .createTable(testResultsTable)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("test_run_id", "uuid", (col) =>
      col.notNull().references(`${testRunsTable}.id`).onDelete("cascade"),
    )
    .addColumn("command", "text", (col) => col.notNull())
    .addColumn("exit_code", "integer", (col) => col.notNull())
    .addColumn("status", "varchar(50)", (col) => col.notNull())
    .addColumn("duration_ms", "integer")
    .addColumn("output", "text")
    .addColumn("error", "text")
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_qa_test_results_run")
    .on(testResultsTable)
    .column("test_run_id")
    .execute();

  await db.schema
    .createTable(defectsTable)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("change_id", "varchar(255)")
    .addColumn("severity", "varchar(50)", (col) => col.notNull())
    .addColumn("title", "varchar(500)", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("file_path", "text")
    .addColumn("line_range", "varchar(50)")
    .addColumn("status", "varchar(50)", (col) =>
      col.notNull().defaultTo("open"),
    )
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_qa_defects_status")
    .on(defectsTable)
    .columns(["status", "severity"])
    .execute();

  await db.schema
    .createTable(fixAttemptsTable)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("defect_id", "uuid", (col) =>
      col.notNull().references(`${defectsTable}.id`).onDelete("cascade"),
    )
    .addColumn("source_sha", "varchar(40)", (col) => col.notNull())
    .addColumn("status", "varchar(50)", (col) => col.notNull())
    .addColumn("result", "text")
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_qa_fix_attempts_defect_id")
    .on(fixAttemptsTable)
    .column("defect_id")
    .execute();

  await db.schema
    .createTable(releasesTable)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("source_sha", "varchar(40)", (col) => col.notNull().unique())
    .addColumn("artifact_digest", "varchar(255)")
    .addColumn("status", "varchar(50)", (col) => col.notNull())
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable(releaseGatesTable)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("release_id", "uuid", (col) =>
      col.notNull().references(`${releasesTable}.id`).onDelete("cascade"),
    )
    .addColumn("gate_name", "varchar(255)", (col) => col.notNull())
    .addColumn("status", "varchar(50)", (col) => col.notNull())
    .addColumn("evidence", "text")
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_qa_release_gates_release_id")
    .on(releaseGatesTable)
    .column("release_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(releaseGatesTable).ifExists().execute();
  await db.schema.dropTable(releasesTable).ifExists().execute();
  await db.schema.dropTable(fixAttemptsTable).ifExists().execute();
  await db.schema.dropTable(defectsTable).ifExists().execute();
  await db.schema.dropTable(testResultsTable).ifExists().execute();
  await db.schema.dropTable(testRunsTable).ifExists().execute();
  await db.schema.dropTable(memoryItemsTable).ifExists().execute();
}
