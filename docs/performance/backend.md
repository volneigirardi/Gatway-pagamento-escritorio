# Backend Performance

## API

- Compression: Brotli preferred, Gzip fallback.
- Keep-alive and HTTP/2 where supported.
- Response time p95 < 200 ms.
- Stateless replicas; no session affinity except for long-polling fallback.

## Database

- Cursor pagination.
- Covering indexes for common queries.
- Connection pool: min 2, max 10 per replica without PgBouncer.
- Query timeout 30 s default.

## Caching

- Cache-aside Redis for read-heavy, stable data.
- TTL <= 5 minutes unless justified.
- Tenant-scoped cache keys.
- Cache invalidation on domain events.

## External Calls

- Timeout: connect 5 s, read 30 s.
- Retry with exponential backoff + jitter.
- Circuit breaker after 5 failures.
- Outbound URL allowlist.

## Workers

- Concurrency configurable per environment.
- Idempotent consumers.
- BullMQ rate limiting and job priorities.
