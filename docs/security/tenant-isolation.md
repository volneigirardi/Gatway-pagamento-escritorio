# Tenant Isolation

## Model

Database-per-tenant with a central `saas-admin` catalog.

## Rules

1. `tenant_id` comes from trusted JWT claim `tid`, never from client input.
2. Every business query must filter by `tenant_id`.
3. Row Level Security (RLS) policies enforce tenant boundaries at the database level.
4. Relationships must be validated within the same tenant.
5. Admin operations are logged and scoped.

## Database-Level Isolation

- Each tenant has its own PostgreSQL database.
- Central catalog maps `tenant_id` -> connection string.
- RLS policies on tenant tables as defense-in-depth.
- Foreign keys enforce referential integrity within tenant.

## Application-Level Isolation

- Request context carries `tenant_id` via AsyncLocalStorage.
- Connection manager resolves tenant DB from context.
- Guards reject cross-tenant URLs/IDs.

## Realtime Isolation

- Socket.IO rooms named `tenant:{tenant_id}`.
- `tenant_id` extracted from authenticated handshake token.
- Client cannot request arbitrary room membership.

## Testing

- Automated negative tests with two real tenants.
- Direct SQL bypass attempt against RLS.
- Cross-tenant object access attempts.

## Known Critical Finding (Fase 5 foundation audit, 2026-08-22)

RLS as currently configured provides **no actual protection** against a
misbehaving/compromised application process, and must not be relied upon as
a real defense-in-depth layer until fixed. Verified empirically against a
disposable PostgreSQL 18.4 container:

1. Migration `004_tenant_isolation_and_audit.ts` ran `ENABLE ROW LEVEL
SECURITY` and created `tenant_isolation_policy`, but PostgreSQL does not
   apply RLS policies to a table's **owner** unless `FORCE ROW LEVEL
SECURITY` is also set — which it was not. With `app.current_tenant` set
   to tenant B, `SELECT * FROM outbox` (no `WHERE`) returned tenant A's rows
   too, connected as the table owner.
   - **Fixed**: migration `005_force_row_level_security.ts` now applies
     `FORCE ROW LEVEL SECURITY` to `outbox`, `idempotency_keys`, and
     `audit_logs`.
2. **Still broken even after the fix above**: `FORCE ROW LEVEL SECURITY`
   does not apply to superusers or roles with the `BYPASSRLS` attribute —
   PostgreSQL always bypasses RLS for them, by design, regardless of
   `FORCE`. The `POSTGRES_USER` bootstrap role created by the official
   `postgres` Docker image (used by `infra/docker/docker-compose.dev.yml`,
   `docker-compose.prod.yml`, and implicitly by `infra/kubernetes/base` via
   the shared `DATABASE_URL`) **is a superuser**. Since the application and
   the migration runner currently connect with the same role, the app
   connects as a superuser and bypasses RLS unconditionally, independent of
   any policy or `FORCE` setting.

**Consequence at audit time**: the only real tenant-isolation control was the
application-level `WHERE tenant_id = ...` filtering in every query (which was
correctly implemented and covered by
`apps/api/test/tenant-isolation.integration.spec.ts`). RLS was decorative,
not a working second layer.

## ADR-014 Remediation Verification (2026-08-24)

Repository implementation now provisions separate `blupo_app`,
`blupo_migrator`, and `blupo_provisioner` roles and independent runtime,
migration, and provisioning connection secrets.

Verified against disposable PostgreSQL 18 instances:

- `blupo_app`: `rolsuper=false`, `rolbypassrls=false`, `rolcreatedb=false`.
- `blupo_app` is not the table owner and cannot read Kysely migration metadata.
- RLS and `FORCE ROW LEVEL SECURITY` are active on tenant tables.
- Tenant A runtime context cannot read, update, delete, or insert Tenant B data.
- Tenant migrations pass zero-to-latest, down, and up using `blupo_migrator`.
- The production migrate container image executes the migration set successfully.
- The complete API integration suite passes 12/12 tests across nine files, plus the worker provisioning integration test passes 1/1.

Production role creation, secret rotation, and live deployment remain NOT TESTED
and are an external release blocker. Explicit application-level `tenant_id`
predicates remain mandatory even with working RLS.
