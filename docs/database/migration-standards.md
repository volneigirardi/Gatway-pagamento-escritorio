# Database Migration Standards

## Tool

- Kysely migrations (explicit SQL).
- No schema synchronization.

## Rules

- Migrations are versioned and immutable.
- One migration file per logical change.
- Include `up` and `down`.
- `down` must restore previous state safely.
- Migrations are idempotent when possible.

## Running Migrations

- Executed as a one-shot job (`infra/kubernetes/base/job-migrate.yaml`, or
  the `migrate` service in `docker-compose.prod.yml`), never on every
  replica startup.
- `pnpm --filter @saas/database-migrations migrate` acquires a Postgres
  advisory lock (`pg_try_advisory_lock`, keyed by target: `tenant`/`admin`)
  before applying migrations, and fails fast if another run holds it —
  see `database/scripts/run-migrations.ts`.
- `pnpm --filter @saas/database-migrations migrate:plan` lists pending
  migrations without applying them (dry-run for review).
- `pnpm --filter @saas/database-migrations migrate:status` shows full
  migration history.
- Backup before destructive changes.
- Known gap: this script migrates one database per invocation. Iterating
  every tenant database is not yet automated — an operator or a wrapper
  Job must loop over tenant connection strings until the `saas-admin`
  catalog and tenant provisioning flow exist.

## Rolling Deploys

- Use expand-and-contract for breaking changes.
- Add new column/index before code uses it.
- Remove old column only after all code stops using it.

## Timeouts

- Migration connection uses `lock_timeout` and `statement_timeout`.
- Long DDL uses `CREATE INDEX CONCURRENTLY` when safe.

## Testing

- Run `up`, then `down`, then `up` in CI.
- Verify rollback leaves database consistent.
- Test migrations against production-like data volume.
