import { type Kysely, sql } from "kysely";

interface TenantTables {
  outbox: { tenant_id: string };
  idempotency_keys: { tenant_id: string };
  audit_logs: { tenant_id: string };
}

/**
 * Fase 5 foundation audit finding (CRITICAL): migration 004 enabled RLS
 * (`ENABLE ROW LEVEL SECURITY`) but never forced it. PostgreSQL does not
 * apply RLS policies to a table's owner by default — and the application
 * connects using the same role that owns these tables (the migration
 * runner's DATABASE_URL user), since no separate least-privilege runtime
 * role exists yet. Verified empirically: with `app.current_tenant` set to
 * tenant B, `SELECT * FROM outbox` (no WHERE clause) returned tenant A's
 * rows too, as `appuser` (the owning role).
 *
 * `FORCE ROW LEVEL SECURITY` makes the policy apply even to the table
 * owner (superusers still bypass it, which is why using a non-superuser
 * runtime role remains important — tracked as a follow-up, see
 * docs/security/tenant-isolation.md).
 */
export async function up(db: Kysely<TenantTables>): Promise<void> {
  const tenantTables = ["outbox", "idempotency_keys", "audit_logs"];
  for (const table of tenantTables) {
    await sql`ALTER TABLE ${sql.ref(table)} FORCE ROW LEVEL SECURITY`.execute(
      db,
    );
  }
}

export async function down(db: Kysely<TenantTables>): Promise<void> {
  const tenantTables = ["outbox", "idempotency_keys", "audit_logs"];
  for (const table of tenantTables) {
    await sql`ALTER TABLE ${sql.ref(table)} NO FORCE ROW LEVEL SECURITY`.execute(
      db,
    );
  }
}
