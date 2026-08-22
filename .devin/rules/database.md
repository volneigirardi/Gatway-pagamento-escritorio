---
description: "Database design, querying, and connection rules"
trigger: model_decision
---

# Database Rules

- Use PostgreSQL 18 with Kysely and `pg` driver.
- All business tables must include `tenant_id`.
- Migrations are explicit, versioned, and reviewed; never use schema sync.
- SQL must be reviewable and committed to the repository.
- Avoid N+1 queries; use joins or batched selects.
- Indexes must include `tenant_id` in composite indexes where filtering by tenant is common.
- Use soft delete for business records; purge only via documented compliance routines.
- Connection pooling per tenant database; consider PgBouncer in production.
- Query plans (EXPLAIN) must be checked for non-trivial queries in a non-production environment.
- Database changes require the `database-review` skill or `postgres-dba` subagent.
