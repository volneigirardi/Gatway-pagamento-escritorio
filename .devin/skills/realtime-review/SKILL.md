---
name: realtime-review
description: Review Socket.IO realtime changes for correctness and isolation
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Review realtime/Socket.IO changes.

1. Check handshake authentication and rejection of missing/invalid tokens.
2. Verify room isolation by tenant.
3. Confirm event names are versioned and typed.
4. Check payload validation with Zod.
5. Verify Redis adapter configuration for horizontal scaling.
6. Confirm events are emitted from outbox/domain handlers, not business logic.
7. Check reconnection, acknowledgement, and deduplication handling.
8. Report findings with file paths and line numbers.

Do not modify code unless asked.
