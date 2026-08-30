# Database Performance Review

## Process

1. Identify query from logs/metrics.
2. Reproduce with representative data.
3. Run `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` in safe environment.
4. Compare estimated vs actual rows.
5. Identify scans, sorts, spills, locks.
6. Propose index or query change.
7. Re-run EXPLAIN and record the before/after baseline.
8. Add a regression test.
9. Run the mandatory `postgres-dba` final review and record its verdict.

## Detection

- `pg_stat_statements` enabled in staging/production.
- Slow query log threshold: 100 ms.
- Alert on p95 query latency.

## Anti-Patterns

- N+1 queries.
- Missing tenant predicate.
- Full table scans on large tables.
- Offset pagination on large datasets.
- Unbounded `IN` lists.

## Baselines

Record baselines in `docs/database/baselines/`. Update after schema/index changes.

## Tooling

- `EXPLAIN`, `EXPLAIN ANALYZE`.
- `pg_stat_statements`.
- Query plan visualizer.
- Load tests with realistic dataset.
