---
description: "Socket.IO realtime gateway rules"
trigger: model_decision
---

# Socket.IO Realtime Rules

- Use Redis adapter (`@socket.io/redis-adapter`) for horizontal scaling.
- Authenticate handshake with JWT; reject unauthenticated connections.
- Users join rooms named `tenant:{tenant_id}` and optionally resource-specific rooms.
- Events are versioned (`v1.<domain>.<event>`) and typed; validate payloads with Zod.
- Socket.IO is for notification only. Critical state is fetched from the API/PostgreSQL.
- Prefer WebSocket transport; enable sticky sessions only if long-polling is used.
- Implement reconnection with capped exponential backoff on the client.
- Log connection/disconnection and security events.
