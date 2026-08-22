import { type Kysely, sql } from "kysely";

interface TenantTables {
  outbox: { tenant_id: string };
  idempotency_keys: { tenant_id: string };
  audit_logs: { tenant_id: string };
}

export async function up(db: Kysely<TenantTables>): Promise<void> {
  // updated_at trigger function
  await sql`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  // Add updated_at, deleted_at and RLS to tenant tables
  const tenantTables = ["outbox", "idempotency_keys", "audit_logs"];

  for (const table of tenantTables) {
    await db.schema
      .alterTable(table)
      .addColumn("updated_at", "timestamptz", (col) =>
        col.defaultTo(sql`now()`),
      )
      .execute();

    await db.schema
      .alterTable(table)
      .addColumn("deleted_at", "timestamptz")
      .execute();

    await sql`
      CREATE TRIGGER ${sql.ref(`${table}_updated_at_trigger`)}
      BEFORE UPDATE ON ${sql.ref(table)}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `.execute(db);

    await sql`ALTER TABLE ${sql.ref(table)} ENABLE ROW LEVEL SECURITY`.execute(
      db,
    );
    await sql`
      CREATE POLICY tenant_isolation_policy ON ${sql.ref(table)}
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
    `.execute(db);
  }

  // Foreign keys to central tenants table cannot be enforced across databases;
  // tenant_id validation happens at application level. Documented in ADR-009.

  // Indexes for soft-delete and common filters
  await db.schema
    .createIndex("idx_outbox_tenant_type_created")
    .on("outbox")
    .columns(["tenant_id", "event_type", "created_at"])
    .where(sql.ref("deleted_at"), "is", null)
    .execute();

  await db.schema
    .createIndex("idx_idempotency_keys_expires")
    .on("idempotency_keys")
    .column("expires_at")
    .execute();

  await db.schema
    .createIndex("idx_audit_logs_action")
    .on("audit_logs")
    .columns(["tenant_id", "action", "created_at"])
    .execute();
}

export async function down(db: Kysely<TenantTables>): Promise<void> {
  const tenantTables = ["outbox", "idempotency_keys", "audit_logs"];
  for (const table of tenantTables) {
    await sql`DROP POLICY IF EXISTS tenant_isolation_policy ON ${sql.ref(table)}`.execute(
      db,
    );
    await sql`ALTER TABLE ${sql.ref(table)} DISABLE ROW LEVEL SECURITY`.execute(
      db,
    );
    await sql`DROP TRIGGER IF EXISTS ${sql.ref(`${table}_updated_at_trigger`)} ON ${sql.ref(table)}`.execute(
      db,
    );
    await db.schema.alterTable(table).dropColumn("deleted_at").execute();
    await db.schema.alterTable(table).dropColumn("updated_at").execute();
  }
  await sql`DROP FUNCTION IF EXISTS update_updated_at_column()`.execute(db);
  await db.schema
    .dropIndex("idx_outbox_tenant_type_created")
    .ifExists()
    .execute();
  await db.schema
    .dropIndex("idx_idempotency_keys_expires")
    .ifExists()
    .execute();
  await db.schema.dropIndex("idx_audit_logs_action").ifExists().execute();
}
