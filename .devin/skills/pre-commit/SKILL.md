---
name: pre-commit
description: Run checks before committing
triggers:
  - user
  - model
allowed-tools:
  - read
  - exec
---

Run pre-commit checks.

1. Run `git status --short` to see changed files and determine whether any file has database impact as defined in `.devin/rules/database.md`.
2. If database impact exists, require actual final output from the `postgres-dba` subagent for the current diff. Invoke it if absent; resolve critical/high findings and rerun after blocking fixes.
3. Run lint for affected packages/apps.
4. Run typecheck for affected packages/apps.
5. Run unit and relevant integration/migration/tenant-isolation tests for affected packages/apps.
6. Run `git diff` and review for secrets, debug code, unrelated changes, and unresolved specialist findings.
7. If any check or mandatory specialist gate fails, stop and report. Do not commit with failing checks.
8. Summarize results, the DBA verdict when applicable, and readiness to commit.

Do not commit unless instructed.
