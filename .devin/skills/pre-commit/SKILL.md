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

1. Run `git status --short` to see changed files.
2. Run lint for affected packages/apps.
3. Run typecheck for affected packages/apps.
4. Run unit tests for affected packages/apps.
5. Run `git diff` and review for secrets, debug code, and unrelated changes.
6. If any check fails, stop and report. Do not commit with failing checks.
7. Summarize results and readiness to commit.

Do not commit unless instructed.
