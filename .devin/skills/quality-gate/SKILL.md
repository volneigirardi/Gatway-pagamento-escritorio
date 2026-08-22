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
7. Review diff for secrets, unrelated changes, and architecture violations.
8. Report pass/fail per gate.

Do not proceed with release if any gate fails.
