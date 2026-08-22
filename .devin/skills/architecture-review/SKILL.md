---
name: architecture-review
description: Review changes for architectural consistency
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Review changes for architectural consistency.

1. Read `docs/project-state.md`, ADRs, and `.devin/rules/architecture.md`.
2. Check module boundaries and dependency direction.
3. Look for coupling between domain modules.
4. Check for duplication or circular dependencies.
5. Verify shared code lives in the correct package.
6. Confirm deployment target compatibility.
7. Report findings with file paths and line numbers.

Do not modify code unless asked.
