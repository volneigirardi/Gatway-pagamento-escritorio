import { type Kysely, sql } from "kysely";

const schemaName = "qa_";
const entitiesTable = `${schemaName}.entities`;
const relationsTable = `${schemaName}.relations`;

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable(entitiesTable)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("type", "varchar(100)", (col) => col.notNull())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("slug", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("description", "text")
    .addColumn("source_sha", "varchar(40)")
    .addColumn("file_path", "text")
    .addColumn("line_range", "varchar(50)")
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_qa_entities_type")
    .on(entitiesTable)
    .column("type")
    .execute();

  await db.schema
    .createIndex("idx_qa_entities_source_sha")
    .on(entitiesTable)
    .column("source_sha")
    .execute();

  await db.schema
    .createTable(relationsTable)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("source_id", "uuid", (col) =>
      col.notNull().references(`${entitiesTable}.id`).onDelete("cascade"),
    )
    .addColumn("target_id", "uuid", (col) =>
      col.notNull().references(`${entitiesTable}.id`).onDelete("cascade"),
    )
    .addColumn("relation_type", "varchar(100)", (col) => col.notNull())
    .addColumn("confidence", "numeric(4, 3)", (col) =>
      col.notNull().defaultTo(1),
    )
    .addColumn("inferred", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("source_sha", "varchar(40)")
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_qa_relations_source")
    .on(relationsTable)
    .columns(["source_id", "relation_type"])
    .execute();

  await db.schema
    .createIndex("idx_qa_relations_target")
    .on(relationsTable)
    .columns(["target_id", "relation_type"])
    .execute();

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_relations_source_target_type
    ON ${sql.ref(relationsTable)} (source_id, target_id, relation_type)
  `.execute(db);

  await sql`
    ALTER TABLE ${sql.ref(relationsTable)}
    ADD CONSTRAINT chk_qa_relations_no_self_loop
    CHECK (source_id <> target_id)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(relationsTable).ifExists().execute();
  await db.schema.dropTable(entitiesTable).ifExists().execute();
}
