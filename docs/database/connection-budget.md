# Database Connection Budget

## Assumptions

- PostgreSQL max_connections: 500.
- PgBouncer recommended in production (transaction pooling).
- Each deployable uses a bounded pool.

## Per-Replica Budget (without PgBouncer)

| Service    | Min | Max |
| ---------- | --- | --- |
| API        | 2   | 10  |
| Worker     | 2   | 10  |
| Scheduler  | 1   | 3   |
| Realtime   | 1   | 5   |
| Migrations | 1   | 1   |
| Margin     | -   | 50  |

Total per tenant DB per replica: ~30 connections.
With 10 replicas: ~300 connections.
Reserve 200 for admin/maintenance.

## With PgBouncer

- Pool mode: transaction.
- Default pool size: 100.
- Reserve overhead for admin connections.

## Scaling Guidance

- Increase `max_connections` or add PgBouncer before scaling replicas.
- Monitor active/waiting connections.
- Add connection pool metrics to dashboards.

## Configuration

```ts
pool: {
  min: 2,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}
```
