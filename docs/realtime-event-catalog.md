# Realtime Event Catalog

> Foundation-phase example events on the shared `EventsGateway`. These are
> scaffolding, not a business feature — real domains will define their own
> events following this same contract.

| Event                 | Direction        | Version | Payload                                     | Authorization                      | Notes                                                        |
| --------------------- | ---------------- | ------- | ------------------------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| `v1.events.join`      | client -> server | v1      | none                                        | requires verified JWT in handshake | joins `tenant:{tenantId}` room derived from the token, ack'd |
| `v1.events.joined`    | server -> client | v1      | `{ tenantId }`                              | n/a                                | confirmation after join                                      |
| `v1.events.broadcast` | client -> server | v1      | `{ eventId: uuid, content: string }`        | tenant JWT + `realtime:broadcast`  | Redis rate limit per tenant/user; deduped by tenant/event ID |
| `v1.events.message`   | server -> client | v1      | `{ eventId, tenantId, content, timestamp }` | scoped to `tenant:{tenantId}` room | broadcast to all sockets joined to the tenant room           |
| `v1.events.error`     | server -> client | v1      | `{ code: string }`                          | n/a                                | `unauthorized`, `rate_limited`, `invalid_payload`            |

Naming convention: `v1.<domain>.<event>`.
All payloads validated with Zod.
Clients fetch authoritative state from the API; Socket.IO is notification only.

## Handshake authentication

The client must send `{ auth: { token } }` on connect. The gateway verifies
the token with `@saas/auth` (`JoseJwtVerifier`, RS256 against
`JWT_PUBLIC_KEY`) and validates issuer, key ID, tenant audience, claims, and
`realm=tenant`; platform tokens cannot join tenant rooms. Socket.IO handshake
middleware rejects invalid connections before any event handler can run.

## Acknowledgements and dedupe

`v1.events.join` and `v1.events.broadcast` accept an optional ack callback
(`(response: { ok: boolean; code?: string }) => void`) so clients can detect
failures and retry safely. `v1.events.broadcast` deduplicates by tenant and
client-supplied `eventId` (UUID) using Redis `SET NX` with a five-minute TTL.
The 20-events-per-10-seconds sliding-window limit is atomic in Redis and keyed
by verified tenant/user identity, so reconnecting or changing replicas does
not reset the limit.

## Known limitations

- Connection/handshake limits are not yet enforced per tenant or source IP.
- Client reconnect/state-rehydration remains a consumer responsibility; clients
  must refetch authoritative state from the API after reconnecting.
