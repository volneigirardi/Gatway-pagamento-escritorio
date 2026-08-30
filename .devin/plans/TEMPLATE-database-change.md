# Database Change Plan: <title>

## Objective

<Business and technical objective>

## Scope

- Affected databases: admin catalog / tenant database / both
- Tables, views, functions, policies, roles, queries, pools, or operations affected:
- Expected data volume and growth:

## Tenant Isolation and Security

- Trusted source of `tenant_id`:
- RLS `USING` / `WITH CHECK` and `FORCE ROW LEVEL SECURITY` impact:
- Runtime, migration, and provisioning role/grant impact:
- Same-tenant keys, uniqueness, foreign keys, and negative two-tenant tests:

## Migration and Rollback

- Expand/contract sequence:
- `up` behavior:
- `down` behavior:
- Lock/table-rewrite risk:
- Backfill strategy and batch size:
- Mixed-version deployment compatibility:
- Backup/restore impact:

## Performance and Capacity Evidence

- Query shape and expected cardinality:
- Existing and proposed indexes:
- `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` before/after evidence or reason unavailable:
- Write amplification and storage impact:
- Pool/timeout/PgBouncer impact:
- Autovacuum/statistics/partitioning considerations:

## Verification

- Migration zero → latest:
- Migration down → up:
- Integration/concurrency tests:
- Tenant-isolation negative tests:
- Backup/restore test when applicable:

## Mandatory PostgreSQL DBA Gate

- `postgres-dba` review requested with:
- Initial verdict:
- Findings and resolutions:
- Rerun verdict after blocking fixes:
- Residual risks explicitly accepted by:

A database-impacting task cannot be completed, committed, or merged without actual `postgres-dba` output and a final verdict of `PASS` or `PASS WITH RISKS`.
