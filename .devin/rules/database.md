---
description: "Mandatory PostgreSQL 18 DBA review, database design, query, security, and performance rules"
trigger: always_on
---

# Database Rules

## Mandatory PostgreSQL DBA gate

- Database impact includes schema, migrations, SQL/Kysely queries, repositories, indexes, constraints, data types, RLS, PostgreSQL roles/grants, connection pools/timeouts, seeds, backup/restore, database observability, and PostgreSQL infrastructure or configuration anywhere in the repository.
- Before implementing a schema or migration change, invoke the `database-change` skill. For reviews and query-only changes, invoke `database-review` as appropriate.
- After implementation and before completion, commit, or merge, always invoke the `postgres-dba` subagent with the exact changed files and relevant tests/evidence. The skill review does not replace this subagent gate.
- If blocking findings are fixed, rerun `postgres-dba` against the resulting diff.
- Critical/high findings block completion. Medium findings must be fixed or explicitly accepted by the user and recorded with rationale. Low/informational findings must be reported or tracked.
- If the `postgres-dba` subagent is unavailable, report the gate as blocked; never claim it passed based on an inline self-review.

## PostgreSQL 18 correctness and tenant isolation

- Use PostgreSQL 18 with Kysely and the `pg` driver.
- All business tables must include `tenant_id`; tenant-owned unique constraints, indexes, foreign keys, and relationships must preserve the tenant boundary.
- Tenant identity comes from trusted authentication context, never unvalidated client input.
- RLS policies, `FORCE ROW LEVEL SECURITY`, runtime/migration role separation, least privilege, and absence of `SUPERUSER`/`BYPASSRLS` must be verified when relevant.
- SQL must be reviewable, parameterized, and committed. Never concatenate untrusted values or identifiers into SQL.

## Performance and capacity

- Avoid N+1 queries; use appropriate joins or batched reads and cursor-based pagination.
- Do not add indexes by intuition alone. Review workload, selectivity, cardinality, write amplification, storage cost, and existing indexes.
- Non-trivial query or index changes require query-shape evidence and, when a safe representative non-production database is available, `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` before/after evidence.
- Never run `EXPLAIN ANALYZE` for mutating or expensive queries in production without explicit approval and a safe execution plan.
- Review transaction scope, lock order, isolation level, deadlock risk, long-running transactions, and online-migration strategy.
- Review connection budgets, pool sizing, timeouts, PgBouncer compatibility, table/index growth, autovacuum, statistics, bloat, and partitioning based on measured need.

## Migrations and operations

- Migrations are explicit, versioned, idempotent where required, and never replaced by schema synchronization.
- Every reversible migration requires a tested `down`; irreversible or destructive migrations require documented reasoning and explicit approval.
- Evaluate lock duration, table rewrite risk, backfill batching, deployment compatibility, rollback, and backup/restore implications.
- Use soft delete for business records; purge only through documented compliance routines.
- Database review evidence must include the DBA verdict, findings and resolutions, tests/migration output, tenant-isolation evidence, and any unavailable evidence or residual risk.
