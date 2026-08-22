import { type Kysely, sql } from "kysely";

const tableName = "tenants";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable(tableName)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("slug", "varchar(100)", (col) => col.notNull().unique())
    .addColumn("database_name", "varchar(128)", (col) => col.notNull().unique())
    .addColumn("database_host", "varchar(255)", (col) => col.notNull())
    .addColumn("status", "varchar(50)", (col) =>
      col.notNull().defaultTo("active"),
    )
    .addColumn("plan", "varchar(50)", (col) =>
      col.notNull().defaultTo("standard"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_tenants_slug")
    .on(tableName)
    .column("slug")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(tableName).ifExists().execute();
}
