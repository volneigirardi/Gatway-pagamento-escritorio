import { type Kysely, sql } from "kysely";

const tableName = "outbox";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable(tableName)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("tenant_id", "uuid", (col) => col.notNull())
    .addColumn("event_type", "varchar(255)", (col) => col.notNull())
    .addColumn("event_version", "varchar(50)", (col) => col.notNull())
    .addColumn("aggregate_id", "varchar(255)", (col) => col.notNull())
    .addColumn("aggregate_type", "varchar(255)", (col) => col.notNull())
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("processed_at", "timestamptz")
    .execute();

  await db.schema
    .createIndex("idx_outbox_unprocessed")
    .on(tableName)
    .columns(["tenant_id", "processed_at", "created_at"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(tableName).ifExists().execute();
}
