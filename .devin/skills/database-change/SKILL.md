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
7. Review query plans for affected queries if non-trivial.
8. Summarize: tables changed, data impact, rollback, risks.

Do not run migrations against production without approval.
