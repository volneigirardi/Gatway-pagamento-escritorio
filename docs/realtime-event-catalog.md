# Realtime Event Catalog

> Foundation-phase example events on the shared `EventsGateway`. These are
> scaffolding, not a business feature — real domains will define their own
> events following this same contract.

| Event                 | Direction       | Version | Payload                             | Authorization                       | Notes                                                          |
| --------------------- | ---------------- | ------- | ------------------------------------ | ------------------------------------ | --------------------------------------------------------------- |
| `v1.events.join`      | client -> server | v1      | none                                 | requires verified JWT in handshake   | joins `tenant:{tenantId}` room derived from the token, ack'd    |
| `v1.events.joined`    | server -> client | v1      | `{ tenantId }`                       | n/a                                   | confirmation after join                                          |
| `v1.events.broadcast` | client -> server | v1      | `{ eventId: uuid, content: string }` | requires verified JWT; rate-limited   | 20 events / 10s per socket; deduped server-side by `eventId`   |
| `v1.events.message`   | server -> client | v1      | `{ eventId, tenantId, content, timestamp }` | scoped to `tenant:{tenantId}` room | broadcast to all sockets joined to the tenant room               |
| `v1.events.error`     | server -> client | v1      | `{ code: string }`                   | n/a                                   | `unauthorized`, `rate_limited`, `invalid_payload`               |

Naming convention: `v1.<domain>.<event>`.
All payloads validated with Zod.
Clients fetch authoritative state from the API; Socket.IO is notification only.

## Handshake authentication

The client must send `{ auth: { token } }` on connect. The gateway verifies
the token signature with `@saas/auth` (`JoseJwtService`, HS256 against
`JWT_SECRET`) — it never trusts an unverified decoded payload. Connections
without a valid token are disconnected immediately (`handleConnection`).

## Acknowledgements and dedupe

`v1.events.join` and `v1.events.broadcast` accept an optional ack callback
(`(response: { ok: boolean; code?: string }) => void`) so clients can detect
failures and retry safely. `v1.events.broadcast` deduplicates by client-supplied
`eventId` (UUID) using a bounded in-memory cache, so a client retry after a
missed ack does not double-broadcast.

## Known limitations

- Dedupe cache is per-process (not shared via Redis), so a retry racing across
  two realtime replicas within the same window could still double-deliver.
  Acceptable for the current example event given non-critical.
- Rate limiting is per-process/per-socket; a client reconnecting rapidly to
  redistribute load across replicas could exceed the intended global limit.
  A production event should also enforce limits centrally (Redis) for
  critical business events.
