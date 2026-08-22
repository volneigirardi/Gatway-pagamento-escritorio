---
name: dependency-evaluation
description: Evaluate a new dependency against project standards
triggers:
  - user
  - model
allowed-tools:
  - read
  - exec
---

Evaluate a proposed dependency before installation.

1. Verify the package exists in the official npm registry.
2. Check maintainer and repository (prefer official repo).
3. Check version, license, and publish date (avoid very recent releases).
4. Check maintenance activity and open security advisories (npm audit, GitHub Security Advisories, OSV).
5. Estimate impact on backend bundle, frontend bundle, and mobile app size.
6. List alternatives.
7. Recommend install only if justified and safe.
8. For structural dependencies, require ADR approval.

Do not install the package unless approved.
