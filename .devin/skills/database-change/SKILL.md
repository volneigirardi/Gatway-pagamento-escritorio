---
name: database-change
description: Plan and review a database schema change
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Plan a database change.

1. Read `docs/project-state.md`, relevant ADRs, and `.devin/rules/database.md`.
2. Identify affected tables, tenant isolation impact, indexes, and constraints.
3. Write migration(s) using Kysely migrations.
4. Provide up and down scripts unless irreversible (requires ADR).
5. Update seed data if needed.
6. Run migration against a local/development database and capture output.
7. Capture query-shape evidence and review query plans for affected non-trivial queries in a safe non-production environment when available.
8. Run tenant-isolation negative tests with two tenants when tenant data paths are affected.
9. After implementation, invoke the `postgres-dba` subagent against the exact diff, migrations, queries, and evidence. This final review is mandatory and is not replaced by this skill.
10. Resolve critical/high findings and rerun `postgres-dba`; medium findings require remediation or explicit documented user acceptance.
11. Summarize: DBA verdict, tables changed, data and tenant impact, performance evidence, rollback, operational risks, and unresolved decisions.

Do not run migrations against production without approval. Do not mark the task complete without actual `postgres-dba` output.
