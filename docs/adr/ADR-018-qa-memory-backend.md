# ADR-018: QA Gatekeeper Persistent Memory Backend

## Status

Accepted

## Context

The QA Gatekeeper agent needs durable memory across sessions for facts, test runs, evidence, defects, releases, and a knowledge graph of system relationships. Memory must be auditable, isolated from production application data, and recoverable without recreating context from scratch.

The project already uses PostgreSQL 18 with Kysely for application data and has an established database-per-tenant model. Adding a separate memory store (Neo4j, dedicated vector DB, etc.) would introduce a new operational surface and another dependency to maintain, contradicting the goal of keeping the QA foundation simple and auditable.

## Decision

Use the existing PostgreSQL 18 instance in the QA/homologation environment for QA memory, in a dedicated schema named `qa_`. Use the `pgvector` extension for semantic embeddings when available; otherwise fall back to JSONB storage with metadata and textual search while still recording that the fallback is approximate.

The memory schema is QA-only and does not mix with application tenant data. No production application code will read from or write to the `qa_` schema. QA memory will be tenant-agnostic at the schema level because it stores facts about the codebase, tests, and infrastructure, not about real customer data.

## Consequences

- Positive: leverages the same Kysely tooling, migrations, backup/restore, and operational expertise already in the project.
- Positive: schema is versioned and reviewable through the `postgres-dba` gate.
- Positive: supports both structured relations and vector search in one store.
- Negative: QA memory shares the same PostgreSQL instance as homologation, so resource contention or unbounded growth can affect test databases. Mitigated by a dedicated schema, small pool, retention policies, and compactMemory routines.
- Negative: `pgvector` requires a pgvector-enabled Docker image, changing the local homologation image from `postgres:18.4` to `pgvector/pgvector:pg18`.

## Compensating controls for tenant-agnostic QA memory

The `qa_` schema is intentionally not tenant-scoped and has no RLS because it stores facts about the codebase, tests, and infrastructure, not customer data. The following controls keep it isolated from production tenant data:

- QA memory lives in a dedicated `qa_` schema, physically separate from application `tenant_id`-scoped tables.
- No production application code will read from or write to the `qa_` schema.
- QA runs use a dedicated small connection pool that targets the `qa_` schema only through the `blupo_app` runtime role, which is granted `USAGE` and minimal DML on `qa_`.
- QA memory is provisioned in the QA/homologation environment only; tenant data is never written to `qa_`.
- `pgvector` is created by the admin/superuser role during provisioning before migrations run under the least-privilege `blupo_migrator` role.

## Related

- ADR-009: Tenant Isolation Strategy
- ADR-014: PostgreSQL Runtime, Migration, and Provisioning Roles
- ADR-016: Mandatory PostgreSQL DBA Review Gate
- `docs/factory/agents/qa/AGENT_CONTRACT.md`
- `docs/factory/qa/QA_EVIDENCE_POLICY.md`
- `packages/qa-agent`
