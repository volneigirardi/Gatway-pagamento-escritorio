# Database Query Standards

## General Rules

- Use Kysely with bound parameters.
- Never concatenate SQL strings.
- Every query on a tenant table must include `tenant_id` predicate.
- Use explicit column lists; avoid `SELECT *`.

## Transactions

- Use `withTransaction(db, callback)` helper.
- Keep transactions short.
- Set `lock_timeout` and `statement_timeout` per migration/operation.
- Retry serialization failures with exponential backoff.

## Pagination

- Prefer cursor-based pagination.
- Default page size 20, max 100.
- Use `created_at` + `id` as cursor.

## Avoid

- N+1 queries; use joins or batched selects.
- Full table scans except on tiny reference tables.
- `SELECT FOR UPDATE` without clear ordering and timeout.
- Long-running queries in request path.

## Query Review

- Non-trivial queries require `EXPLAIN` review.
- Use `EXPLAIN ANALYZE` only in non-production.
- Document baseline latency and rows.

## Tenant Context

- Kysely plugin or wrapper auto-injects `tenant_id` from `RequestContext`.
- Tests verify missing predicate is caught by RLS.
