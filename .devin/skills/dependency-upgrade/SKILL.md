---
name: dependency-upgrade
description: Evaluate and plan a dependency upgrade
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Plan a dependency upgrade.

1. Identify current version and proposed version.
2. Read the package's official changelog/release notes.
3. Check for breaking changes, security fixes, and deprecations.
4. Search the codebase for usages.
5. Estimate test and migration effort.
6. Run `pnpm audit` after upgrade in a branch.
7. Run tests and type checks.
8. Summarize risks and recommended upgrade path.

Do not merge without approval and green CI.
