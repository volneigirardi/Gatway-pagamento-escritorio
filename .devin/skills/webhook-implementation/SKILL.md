---
name: webhook-implementation
description: Implement or review inbound/outbound webhooks
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

Implement or review webhook functionality.

1. Read `.devin/rules/webhooks.md` and relevant specs.
2. For outbound webhooks:
   - Store subscriptions per tenant.
   - Sign payloads with HMAC-SHA256 (`X-Webhook-Signature`).
   - Use idempotency key and event_id.
   - Retry with exponential backoff and dead-letter.
3. For inbound webhooks:
   - Validate signature when provider supports it.
   - Validate payload with Zod.
   - Emit domain event via transactional outbox.
4. Add tests for success, failure, retry, idempotency, and signature validation.
5. Record delivery in `webhook_delivery_logs` and `audit_logs`.

Never log secrets or full payload signatures.
