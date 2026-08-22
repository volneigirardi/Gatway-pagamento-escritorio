---
name: realtime-change
description: Plan and implement a realtime/Socket.IO change
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
  - edit
---

Implement a realtime change.

1. Read `.devin/rules/realtime-socketio.md`.
2. Authenticate handshake with JWT; reject unauthenticated connections.
3. Scope rooms to `tenant:{tenant_id}`.
4. Version event names: `v1.<domain>.<event>`.
5. Validate payloads with Zod.
6. Emit events from domain event handlers, not directly from business logic.
7. Client reconnects with capped backoff; fetches current state from API on reconnect.
8. Add tests for authentication, tenant isolation, reconnection, and event validation.

Never treat Socket.IO as a database or authoritative source of truth.
