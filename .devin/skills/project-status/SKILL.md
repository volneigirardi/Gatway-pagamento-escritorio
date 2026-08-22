---
name: project-status
description: Show what has changed since the last known state
triggers:
  - user
  - model
allowed-tools:
  - read
  - exec
  - grep
---

Determine the current status of the repository:

1. Read `docs/project-state.md`.
2. Run `git status --short` and `git log --oneline -10`.
3. Check for uncommitted changes, recent commits, and branch.
4. Report:
   - Working tree status
   - Recent commits
   - Current branch
   - Any files modified outside the expected plan
   - Recommendations before continuing

Do not modify files.
