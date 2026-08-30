---
name: quality-gate
description: Run full quality gate before a release or merge
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Run the full quality gate.

1. Run lint across all packages and apps.
2. Run typecheck across all packages and apps.
3. Run unit and integration tests.
4. Run E2E tests if applicable.
5. Run `pnpm audit`.
6. Run tenant isolation tests.
7. Detect database impact using `.devin/rules/database.md`. If present, invoke `postgres-dba` on the final diff and evidence; fail on unresolved critical/high findings or missing review output.
8. Review diff for secrets, unrelated changes, architecture violations, and unresolved specialist findings.
9. Report pass/fail per gate, including the DBA verdict when applicable.

Do not proceed with release if any gate or mandatory specialist review fails.
