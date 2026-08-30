# PostgreSQL Role Bootstrap

## Purpose

Create and verify the separated runtime, migration, and provisioning roles required by ADR-014.

## Prerequisites

- PostgreSQL 18 administrative connection for the target dedicated Blupo database.
- Three independent random passwords of at least 32 characters supplied through a secrets manager or ephemeral environment.
- Reviewed backup and maintenance window for an existing database because table/function ownership is reassigned to `blupo_migrator`.
- No production execution without operator approval.

## Development Procedure

1. Set `DATABASE_ADMIN_URL`, `APP_DATABASE_PASSWORD`, `MIGRATION_DATABASE_PASSWORD`, and `PROVISIONER_DATABASE_PASSWORD` outside Git.
2. Run `pnpm --filter @saas/database-migrations roles:bootstrap`.
3. Set runtime `DATABASE_URL` to `blupo_app` and `MIGRATION_DATABASE_URL` to `blupo_migrator`.
4. Run `pnpm --filter @saas/database-migrations migrate -- admin` for the catalog or `... migrate -- tenant` for one tenant database.
5. Do not provide `DATABASE_ADMIN_URL` or `MIGRATION_DATABASE_URL` to runtime application containers.

## Production Procedure

Provision roles and credentials through the selected infrastructure/secrets system using ADR-014 as the privilege contract. The repository bootstrap command is not automatically executed against production. Run migrations as a one-shot job with only `MIGRATION_DATABASE_URL`.

## Verification

Verify role attributes:

```sql
SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
FROM pg_roles
WHERE rolname IN ('blupo_app', 'blupo_migrator', 'blupo_provisioner')
ORDER BY rolname;
```

Expected:

- `blupo_app`: no superuser, RLS bypass, database creation, or role creation.
- `blupo_migrator`: no superuser, RLS bypass, database creation, or role creation.
- `blupo_provisioner`: only database creation is enabled.

Verify ownership and grants:

```sql
SELECT tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public';

SELECT
  has_table_privilege('blupo_app', 'public.outbox', 'SELECT') AS business_read,
  has_table_privilege('blupo_app', 'public.kysely_migration', 'SELECT') AS migration_metadata_read;
```

Business access must be true, migration metadata access false, and application tables must not be owned by `blupo_app`.

Run the automated role/RLS integration test before accepting the environment:

```text
pnpm --filter @saas/api test:integration
```

## Rollback

Stop runtime services and restore the previous connection secret only under a formally accepted emergency security exception. Do not drop roles or reassign ownership automatically. Preserve data and collect role/grant output for incident review.

## Escalation

Escalate any unexpected superuser/BYPASSRLS flag, ownership mismatch, cross-tenant visibility, or migration privilege failure to the database/security owner before enabling traffic.

## References

- `docs/adr/ADR-014-database-runtime-roles.md`
- `docs/security/tenant-isolation.md`
- `docs/database/migration-standards.md`
