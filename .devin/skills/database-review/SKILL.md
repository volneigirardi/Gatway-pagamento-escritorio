---
name: database-review
description: Review PostgreSQL schema, migrations, queries, security, and performance before mandatory DBA sign-off
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Review database-related changes.

1. Read changed and adjacent migrations, schema definitions, queries/repositories, pool/configuration, tests, ADRs, and database standards.
2. Verify every multi-tenant table and data path has trusted `tenant_id` scoping and tenant-aware indexes/constraints/foreign keys.
3. Review RLS/`FORCE ROW LEVEL SECURITY`, runtime/migration role separation, least privilege, grants, ownership, and injection risks.
4. Check query shape, N+1 patterns, joins, pagination, cardinality, indexes, transaction scope, locks, deadlocks, and timeouts.
5. Check migration `up`/`down`, idempotency, lock/rewrite risk, backfill strategy, mixed-version compatibility, rollback, and backup/restore impact.
6. Require query-shape justification and, for non-trivial query/index changes when a safe representative environment is available, `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` evidence.
7. Review pool sizing, total connection budget, PgBouncer compatibility, table/index growth, autovacuum/statistics, bloat, and partitioning based on measured need.
8. Run or inspect two-tenant negative tests when tenant isolation is affected.
9. Invoke the `postgres-dba` subagent after implementation for final sign-off. This skill supplements and never replaces the mandatory subagent gate.
10. Report the DBA verdict and findings with file paths and line numbers, classified as critical/high/medium/low/informational. Resolve critical/high findings and rerun the subagent.

Do not modify code unless explicitly instructed. Do not claim the database gate passed without actual `postgres-dba` output.
