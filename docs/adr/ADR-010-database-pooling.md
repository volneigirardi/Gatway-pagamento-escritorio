# ADR-010: Database Connection Pooling

## Status

Accepted

## Context

Database-per-tenant multiplies connection demand. Need bounded pools and graceful behavior.

## Decision

- Each deployable uses bounded `pg.Pool` with min/max, idle timeout, connection timeout.
- Default per-replica pool: min 2, max 10 per tenant database in dev/staging.
- Production deploys PgBouncer in transaction-pooling mode.
- Pool metrics exported to observability.

## Consequences

- Positive: prevents connection exhaustion, observable.
- Negative: requires PgBouncer operational expertise.
