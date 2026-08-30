# ADR-016: Mandatory PostgreSQL DBA Review Gate

## Status

Accepted

## Context

The repository already had a read-only `postgres-dba` specialist and database review skills. However, database rules were loaded only by model decision and allowed either the inline `database-review` skill or the specialist subagent. Pre-commit, quality, and task-completion workflows did not require evidence from the specialist. A database-impacting task could therefore finish without independent PostgreSQL review.

The product is a regulated, database-per-tenant fintech SaaS. Schema, query, migration, RLS, role, pool, and backup decisions can affect tenant isolation, data integrity, security, availability, and latency across the entire application.

## Decision

Every task with database impact must use the appropriate database skill and receive a final read-only review from the `postgres-dba` subagent after implementation and before completion, commit, or merge.

Database impact includes:

- schema, migrations, seeds, and data backfills;
- SQL/Kysely queries, repositories, indexes, constraints, and transactions;
- RLS, roles, grants, ownership, tenant isolation, and PostgreSQL security;
- connection pools, timeouts, PgBouncer, PostgreSQL configuration, and capacity;
- backup, restore, maintenance, observability, and database infrastructure.

The `database-review` skill supplements but never replaces the final specialist gate. Critical/high findings block completion. Medium findings require remediation or explicit documented user acceptance. Blocking fixes require a new `postgres-dba` pass against the resulting diff.

Rules are versioned in `AGENTS.md`, `.devin/rules/database.md`, `.devin/rules/migrations.md`, scoped AGENTS files, and task skills. The `UserPromptSubmit` hook reinforces the rule in every session. Actual subagent output and verdict are required evidence; an inline self-review cannot be presented as specialist approval.

## Evidence Standard

For non-trivial query or index changes, the review requires query-shape justification and, when a safe representative non-production environment is available, before/after `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` evidence. Reviews must also cover tenant/RLS tests, migration up/down and locking, connection budget, and backup/restore impact as applicable.

## Consequences

- Positive: independent PostgreSQL expertise becomes a consistent gate for correctness, security, operability, and measured performance.
- Positive: database decisions and unresolved risks become auditable.
- Negative: database-impacting work incurs additional review time and subagent usage.
- Negative: when subagents are disabled or unavailable, database work remains blocked rather than silently falling back to self-review.
- Limitation: repository governance can require and document the review, but CI cannot itself launch an interactive Devin subagent; automated database checks remain complementary rather than equivalent.

## Related

- ADR-009: Tenant Isolation Strategy
- ADR-010: Database Connection Pooling
- ADR-014: PostgreSQL Runtime, Migration, and Provisioning Roles
- `.devin/agents/postgres-dba.md`
- `.devin/rules/database.md`
- `docs/database/performance-review.md`
