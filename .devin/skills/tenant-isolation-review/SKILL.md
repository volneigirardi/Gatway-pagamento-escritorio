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
7. Look for negative tests that prove cross-tenant access is blocked.
8. Report gaps with file paths and line numbers.

Do not modify code unless asked.
