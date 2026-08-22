# Database Index Standards

## When to Create an Index

- Query filters by the column and returns a small subset.
- Foreign key columns.
- Unique constraints require an index.
- Sorting/pagination columns.

## When NOT to Create an Index

- Without a query and evidence.
- On low-cardinality columns alone.
- On frequently updated columns unless necessary.

## Composite Index Rules

- Leading column is the most selective, typically `tenant_id`.
- Include columns used in WHERE, ORDER BY, JOIN.
- Partial indexes for common filters (e.g., `deleted_at IS NULL`).

## Naming

`idx_{table}_{columns}[_partial]`

## Maintenance

- Use `CREATE INDEX CONCURRENTLY` in production.
- Monitor index bloat and usage (`pg_stat_user_indexes`).
- Rebuild when bloat > 30%.

## Examples

```sql
CREATE INDEX CONCURRENTLY idx_invoices_tenant_status_created
ON invoices(tenant_id, status, created_at)
WHERE deleted_at IS NULL;
```
