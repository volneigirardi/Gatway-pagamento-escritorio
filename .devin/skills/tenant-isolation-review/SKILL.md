---
name: tenant-isolation-review
description: Verify tenant isolation in data access paths
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Verify tenant isolation.

1. Identify every data access path in the changed code.
2. Confirm `tenant_id` is derived from trusted authentication context.
3. Verify queries filter by `tenant_id`.
4. Verify relationships are validated within the tenant.
5. Check unique constraints and indexes include `tenant_id` where needed.
6. Confirm jobs, events, and Socket.IO rooms carry validated `tenant_id`.
7. Look for automated negative tests with two tenants that prove cross-tenant access is blocked.
8. If schema, migrations, PostgreSQL queries, indexes/constraints, RLS, roles/grants, or database configuration are affected, invoke the mandatory `postgres-dba` subagent for final review.
9. Report gaps with file paths and line numbers, including the DBA verdict when applicable.

Do not modify code unless asked. This skill does not replace the mandatory DBA gate.
