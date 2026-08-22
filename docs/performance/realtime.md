# Realtime Performance

## Targets

- Concurrent connections per replica: 10,000.
- Event latency p95 < 100 ms.
- Reconnect time < 5 s.

## Scaling

- WebSocket preferred; long-polling only with sticky sessions.
- Redis adapter for multi-replica broadcast.
- Tenant-scoped rooms.

## Limits

- maxHttpBufferSize: 1 MB.
- Per-tenant connection limit (configurable).
- Message rate limit per connection.

## Resilience

- Exponential backoff reconnect with cap.
- Heartbeat/ping timeout.
- Graceful shutdown with draining.
- Redis adapter reconnection.
