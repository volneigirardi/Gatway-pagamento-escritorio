---
name: database-review
description: Review database schema, queries, and migrations
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Review database-related changes.

1. Read changed migrations, schema definitions, and relevant queries.
2. Verify every multi-tenant table has `tenant_id` and uses it in indexes/constraints.
3. Check for N+1 queries, missing indexes, and inefficient joins.
4. Verify foreign keys reference rows within the same tenant where applicable.
5. Check migration rollback (`down`) scripts.
6. Look for injection risks or unsafe dynamic SQL.
7. Report findings with file paths and line numbers, classified as critical/high/medium/low/informational.

Do not modify code unless explicitly instructed.
