import { type Kysely, sql } from "kysely";

const tenantTables = [
  "users",
  "roles",
  "permissions",
  "user_roles",
  "role_permissions",
  "company_settings",
];

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("tenant_id", "uuid", (column) => column.notNull())
    .addColumn("identity_id", "uuid", (column) => column.notNull())
    .addColumn("email", "varchar(320)", (column) => column.notNull())
    .addColumn("normalized_email", "varchar(320)", (column) => column.notNull())
    .addColumn("display_name", "varchar(160)", (column) => column.notNull())
    .addColumn("status", "varchar(20)", (column) =>
      column.notNull().defaultTo("active"),
    )
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .addUniqueConstraint("uq_users_tenant_id", ["tenant_id", "id"])
    .addUniqueConstraint("uq_users_tenant_identity", [
      "tenant_id",
      "identity_id",
    ])
    .addUniqueConstraint("uq_users_tenant_email", [
      "tenant_id",
      "normalized_email",
    ])
    .addCheckConstraint(
      "chk_users_status",
      sql`status IN ('active', 'disabled')`,
    )
    .execute();

  await sql`
    CREATE INDEX idx_users_tenant_status
    ON users (tenant_id, status)
    WHERE deleted_at IS NULL
  `.execute(db);

  await db.schema
    .createTable("roles")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("tenant_id", "uuid", (column) => column.notNull())
    .addColumn("name", "varchar(120)", (column) => column.notNull())
    .addColumn("slug", "varchar(100)", (column) => column.notNull())
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
    .addUniqueConstraint("uq_roles_tenant_id", ["tenant_id", "id"])
    .addUniqueConstraint("uq_roles_tenant_slug", ["tenant_id", "slug"])
    .addCheckConstraint("chk_roles_slug", sql`slug ~ '^[a-z0-9:_-]+$'`)
    .execute();

  await db.schema
    .createTable("permissions")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("tenant_id", "uuid", (column) => column.notNull())
    .addColumn("key", "varchar(128)", (column) => column.notNull())
    .addColumn("description", "text")
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .addUniqueConstraint("uq_permissions_tenant_id", ["tenant_id", "id"])
    .addUniqueConstraint("uq_permissions_tenant_key", ["tenant_id", "key"])
    .addCheckConstraint(
      "chk_permissions_key",
      sql`key ~ '^[a-z0-9][a-z0-9:_-]{0,127}$'`,
    )
    .execute();

  await db.schema
    .createTable("user_roles")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("tenant_id", "uuid", (column) => column.notNull())
    .addColumn("user_id", "uuid", (column) => column.notNull())
    .addColumn("role_id", "uuid", (column) => column.notNull())
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .addForeignKeyConstraint(
      "fk_user_roles_user",
      ["tenant_id", "user_id"],
      "users",
      ["tenant_id", "id"],
      (constraint) => constraint.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_user_roles_role",
      ["tenant_id", "role_id"],
      "roles",
      ["tenant_id", "id"],
      (constraint) => constraint.onDelete("cascade"),
    )
    .execute();

  await sql`
    CREATE UNIQUE INDEX uq_user_roles_active
    ON user_roles (tenant_id, user_id, role_id)
    WHERE deleted_at IS NULL
  `.execute(db);

  await db.schema
    .createTable("role_permissions")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("tenant_id", "uuid", (column) => column.notNull())
    .addColumn("role_id", "uuid", (column) => column.notNull())
    .addColumn("permission_id", "uuid", (column) => column.notNull())
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .addForeignKeyConstraint(
      "fk_role_permissions_role",
      ["tenant_id", "role_id"],
      "roles",
      ["tenant_id", "id"],
      (constraint) => constraint.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_role_permissions_permission",
      ["tenant_id", "permission_id"],
      "permissions",
      ["tenant_id", "id"],
      (constraint) => constraint.onDelete("cascade"),
    )
    .execute();

  await sql`
    CREATE UNIQUE INDEX uq_role_permissions_active
    ON role_permissions (tenant_id, role_id, permission_id)
    WHERE deleted_at IS NULL
  `.execute(db);

  await db.schema
    .createTable("company_settings")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("tenant_id", "uuid", (column) => column.notNull().unique())
    .addColumn("legal_name", "varchar(255)")
    .addColumn("trade_name", "varchar(255)")
    .addColumn("tax_id", "varchar(14)")
    .addColumn("contact_email", "varchar(320)")
    .addColumn("timezone", "varchar(64)", (column) =>
      column.notNull().defaultTo("America/Sao_Paulo"),
    )
    .addColumn("locale", "varchar(20)", (column) =>
      column.notNull().defaultTo("pt-BR"),
    )
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .addCheckConstraint(
      "chk_company_settings_tax_id",
      sql`tax_id IS NULL OR tax_id ~ '^[0-9]{14}$'`,
    )
    .execute();

  await db.schema
    .alterTable("audit_logs")
    .addForeignKeyConstraint(
      "fk_audit_logs_actor",
      ["tenant_id", "actor_id"],
      "users",
      ["tenant_id", "id"],
      (constraint) => constraint.onDelete("restrict"),
    )
    .execute();

  for (const table of tenantTables) {
    await sql`
      CREATE TRIGGER ${sql.ref(`${table}_updated_at_trigger`)}
      BEFORE UPDATE ON ${sql.ref(table)}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `.execute(db);
    await sql`ALTER TABLE ${sql.ref(table)} ENABLE ROW LEVEL SECURITY`.execute(
      db,
    );
    await sql`ALTER TABLE ${sql.ref(table)} FORCE ROW LEVEL SECURITY`.execute(
      db,
    );
    await sql`
      CREATE POLICY tenant_isolation_policy ON ${sql.ref(table)}
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
    `.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("audit_logs")
    .dropConstraint("fk_audit_logs_actor")
    .execute();

  for (const table of [...tenantTables].reverse()) {
    await sql`
      DROP POLICY IF EXISTS tenant_isolation_policy ON ${sql.ref(table)}
    `.execute(db);
    await sql`ALTER TABLE ${sql.ref(table)} NO FORCE ROW LEVEL SECURITY`.execute(
      db,
    );
    await sql`ALTER TABLE ${sql.ref(table)} DISABLE ROW LEVEL SECURITY`.execute(
      db,
    );
    await sql`
      DROP TRIGGER IF EXISTS ${sql.ref(`${table}_updated_at_trigger`)}
      ON ${sql.ref(table)}
    `.execute(db);
  }

  await db.schema.dropTable("company_settings").ifExists().execute();
  await db.schema.dropTable("role_permissions").ifExists().execute();
  await db.schema.dropTable("user_roles").ifExists().execute();
  await db.schema.dropTable("permissions").ifExists().execute();
  await db.schema.dropTable("roles").ifExists().execute();
  await db.schema.dropTable("users").ifExists().execute();
}
