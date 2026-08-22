---
description: "External integration design and safety rules"
trigger: model_decision
---

# External Integration Rules

- Every integration is a plugin-like module with tenant-scoped configuration.
- Credentials encrypted at rest (AES-256-GCM); never logged.
- Outbound calls use circuit breaker, retries with jittered backoff, and timeouts.
- Idempotency key must be sent for all mutating external calls.
- Log all integration requests/responses (without secrets) in `integration_logs`.
- Validate incoming payloads with Zod.
- Use mTLS for financial institution integrations when supported.
- Each integration requires a spec and security review.
