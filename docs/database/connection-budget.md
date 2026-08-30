# Database Connection Budget

## Assumptions

- PostgreSQL `max_connections`: 500 until production topology is finalized.
- PgBouncer transaction pooling is required in production.
- API HPA maximum: 10 replicas.
- Worker HPA maximum: 8 replicas.
- Tenant database pools are lazy (`min=0`) and bounded by an LRU cache.

## Configured Per-Replica Limits

| Service       | Admin pool | Tenant cache × pool |    Short-lived privileged connections | Maximum |
| ------------- | ---------: | ------------------: | ------------------------------------: | ------: |
| API           |          5 |              10 × 1 |                                     0 |      15 |
| Worker        |          5 |                   0 | up to 8 at provisioning concurrency 4 |      13 |
| Scheduler     |          5 |                   0 |                                     0 |       5 |
| Migration Job |          0 |                   0 |                                     1 |       1 |

## Worst-Case Server Budget

| Workload                                           | Calculation      | Connections |
| -------------------------------------------------- | ---------------- | ----------: |
| API                                                | 10 replicas × 15 |         150 |
| Worker                                             | 8 replicas × 13  |         104 |
| Scheduler                                          | 2 replicas × 5   |          10 |
| Migration Job                                      | one-shot         |           1 |
| Operator, monitoring, maintenance, failover margin | reserved         |         100 |
| **Total planned ceiling**                          |                  |     **365** |

The remaining 167 connections are not a scaling target. They protect failover, rollout overlap, delayed pool eviction, and incident response. Horizontal replica limits or pool/cache values must not increase without a new calculation and `postgres-dba` review.

## PgBouncer

- Pool mode: transaction.
- Size PgBouncer from observed active transactions, not client pool maxima.
- Verify session-dependent features before transaction pooling; tenant context uses transaction-local `set_config(..., true)`.
- Monitor client wait time, server utilization, transaction duration, and rejected clients.

## Required Metrics and Alerts

- Active, idle, waiting, and maximum pool connections by deployable.
- Tenant pool cache occupancy and eviction count.
- PostgreSQL active connections and percentage of `max_connections`.
- PgBouncer client waiting and server-pool saturation.
- Alert at 70% sustained utilization and 85% immediate utilization.
