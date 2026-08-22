---
name: new-feature
description: Plan and prepare a new feature before implementation
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Prepare a new feature. Do not implement without user approval.

1. Read the current state (`docs/project-state.md`, `AGENTS.md`).
2. Locate similar existing features (grep/glob).
3. Consult relevant rules in `.devin/rules/`.
4. Consult relevant ADRs in `docs/adr/`.
5. Create or update a spec under `docs/specs/` using `docs/specs/TEMPLATE.md`.
6. Define acceptance criteria, scope, and out-of-scope.
7. Identify impact on:
   - Database (tables, migrations, indexes)
   - Multi-tenancy
   - Security
   - Performance
   - Web and mobile
8. Present the plan and wait for approval before writing code.

Do not start implementation until explicitly approved.
