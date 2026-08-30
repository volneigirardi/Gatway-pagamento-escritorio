import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("platform_roles")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("name", "varchar(120)", (column) => column.notNull())
    .addColumn("slug", "varchar(100)", (column) => column.notNull().unique())
    .addColumn("description", "text")
    .addColumn("reserved", "boolean", (column) =>
      column.notNull().defaultTo(false),
    )
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .addCheckConstraint("chk_platform_roles_slug", sql`slug ~ '^[a-z0-9:_-]+$'`)
    .execute();

  await db.schema
    .createTable("platform_permissions")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("key", "varchar(128)", (column) => column.notNull().unique())
    .addColumn("description", "text")
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .addCheckConstraint(
      "chk_platform_permissions_key",
      sql`key ~ '^[a-z0-9][a-z0-9:_-]{0,127}$'`,
    )
    .execute();

  await db.schema
    .createTable("platform_identity_roles")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("identity_id", "uuid", (column) =>
      column.notNull().references("identities.id").onDelete("cascade"),
    )
    .addColumn("role_id", "uuid", (column) =>
      column.notNull().references("platform_roles.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .execute();

  await sql`
    CREATE UNIQUE INDEX uq_platform_identity_roles_active
    ON platform_identity_roles (identity_id, role_id)
    WHERE deleted_at IS NULL
  `.execute(db);

  await db.schema
    .createTable("platform_role_permissions")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("role_id", "uuid", (column) =>
      column.notNull().references("platform_roles.id").onDelete("cascade"),
    )
    .addColumn("permission_id", "uuid", (column) =>
      column
        .notNull()
        .references("platform_permissions.id")
        .onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .execute();

  await sql`
    CREATE UNIQUE INDEX uq_platform_role_permissions_active
    ON platform_role_permissions (role_id, permission_id)
    WHERE deleted_at IS NULL
  `.execute(db);

  for (const table of [
    "platform_roles",
    "platform_permissions",
    "platform_identity_roles",
    "platform_role_permissions",
  ]) {
    await sql`
      CREATE TRIGGER ${sql.ref(`${table}_updated_at_trigger`)}
      BEFORE UPDATE ON ${sql.ref(table)}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of [
    "platform_role_permissions",
    "platform_identity_roles",
    "platform_permissions",
    "platform_roles",
  ]) {
    await sql`
      DROP TRIGGER IF EXISTS ${sql.ref(`${table}_updated_at_trigger`)}
      ON ${sql.ref(table)}
    `.execute(db);
  }
  await db.schema.dropTable("platform_role_permissions").ifExists().execute();
  await db.schema.dropTable("platform_identity_roles").ifExists().execute();
  await db.schema.dropTable("platform_permissions").ifExists().execute();
  await db.schema.dropTable("platform_roles").ifExists().execute();
}
