# Performance Budgets

## Baseline Targets

All numbers are initial targets. Final values require measurement in a defined environment.

| Metric              | p50   | p95    | p99    |
| ------------------- | ----- | ------ | ------ |
| API request latency | 50 ms | 200 ms | 500 ms |
| Database query      | 5 ms  | 30 ms  | 100 ms |
| Socket.IO ack       | 20 ms | 100 ms | 200 ms |
| Web LCP             | -     | 2.5 s  | -      |
| Web INP             | -     | 200 ms | -      |
| Mobile startup      | -     | 2 s    | 3 s    |

## Throughput

- API: 1,000 RPS per replica initial target.
- Socket.IO: 10,000 concurrent connections per replica.
- Worker: 100 jobs/second per queue.

## Error Rates

- HTTP 5xx: < 0.1%.
- Job failures (after retries): < 0.5%.
- Socket.IO rejected events: < 0.1%.

## Resource

- API: 1 CPU, 1 GiB per replica.
- Worker: 0.5 CPU, 512 MiB per replica.
- Database CPU: < 70% sustained.

## Measurement Requirements

Before publishing final numbers, document:

- Hardware / node size.
- Environment and version.
- Dataset size and tenant count.
- Concurrency and duration.
- Configuration (pool sizes, rate limits, etc.).
