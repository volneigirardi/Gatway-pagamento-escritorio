---
description: "Webhook delivery and reception rules"
trigger: model_decision
---

# Webhook Rules

- Webhook subscriptions stored per tenant.
- Outbound payloads signed with HMAC-SHA256 in `X-Webhook-Signature`.
- Idempotency via `event_id` + `idempotency_key`.
- Retries with exponential backoff; dead-letter after max attempts.
- Inbound webhooks validated by signature when the provider supports it.
- Delivery events published via transactional outbox.
- Webhook endpoints do not expose internal stack traces or secrets.
