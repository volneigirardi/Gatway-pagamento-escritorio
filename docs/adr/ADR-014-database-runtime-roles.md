# ADR-014: PostgreSQL Runtime, Migration, and Provisioning Roles

## Status

Accepted

## Context

ADR-009 requires RLS as defense in depth. The foundation audit proved that the current application connection uses the `POSTGRES_USER` bootstrap superuser, which bypasses RLS even when tables use `FORCE ROW LEVEL SECURITY`. Runtime services, migrations, and tenant provisioning also have different privilege requirements and must not share one credential.

## Decision

Use separate PostgreSQL roles and connection secrets:

- `blupo_app`: login role used by API, worker, and scheduler for runtime DML. It is `NOSUPERUSER`, `NOBYPASSRLS`, `NOCREATEDB`, `NOCREATEROLE`, does not own tables, and receives only required `CONNECT`, `USAGE`, `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and sequence privileges.
- `blupo_migrator`: login role used only by one-shot migration jobs. It owns application schemas/tables and may execute reviewed DDL. Runtime containers never receive this credential.
- `blupo_provisioner`: login role used only by the tenant-provisioning worker path. It may create tenant databases from server-derived identifiers but receives no application-table DML privileges.

Configuration is split into `DATABASE_URL`, `MIGRATION_DATABASE_URL`, and `TENANT_PROVISIONER_DATABASE_URL`. Secrets are supplied out of band in production. Development role bootstrap is explicit and idempotent; production role creation remains an operator/IaC action.

Tenant repositories execute inside a transaction that sets `app.current_tenant` with `set_config(..., true)`. Every tenant table uses RLS and `FORCE ROW LEVEL SECURITY`, while application queries retain explicit `tenant_id` predicates.

Automated integration tests must connect as `blupo_app` and verify `rolsuper = false`, `rolbypassrls = false`, and cross-tenant denial for read and write operations.

## Consequences

- Positive: RLS becomes an actual runtime boundary instead of documentation-only protection.
- Positive: a compromised runtime process cannot execute DDL or create databases with its normal connection.
- Positive: migration and provisioning privileges can be rotated and audited independently.
- Negative: three database secrets and role lifecycle procedures must be operated.
- Negative: tenant provisioning needs a narrowly scoped privileged worker path and additional failure handling.

## Rollback

Runtime services can temporarily be pointed back to the previous connection only as an emergency rollback with a formally accepted security risk. Database roles and grants are not dropped automatically; rollback revokes service use while preserving data.

## Related

- ADR-009: Tenant Isolation Strategy
- ADR-010: Database Connection Pooling
- `docs/security/tenant-isolation.md`
- `docs/database/migration-standards.md`
