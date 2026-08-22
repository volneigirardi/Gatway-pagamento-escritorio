---
description: "Enforce tenant isolation in every data access path"
trigger: always_on
---

# Multi-Tenancy Rules

- `tenant_id` must come from trusted authentication context, never from an unvalidated client header or body.
- Every query to a multi-tenant table must include `tenant_id` filtering.
- When joining related resources, verify the related resource belongs to the same tenant.
- Unique constraints and indexes must include `tenant_id` where applicable.
- Jobs, events, webhooks, and Socket.IO rooms must carry a validated `tenant_id`.
- Authorization decisions happen in the backend; frontend UI state must not replace server checks.
- Write negative tests that prove tenant A cannot read or mutate tenant B data.
- Administrative bypass must be explicit, audit-logged, and isolated from regular user flows.
- All changes touching tenant boundaries require review by the `tenant-isolation-review` skill or `appsec-reviewer`.
