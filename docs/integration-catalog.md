# Integration Catalog

> This catalog lists planned external integrations. Empty during foundation phase.

| Integration             | Provider                          | Type             | Status  | Notes                                               |
| ----------------------- | --------------------------------- | ---------------- | ------- | --------------------------------------------------- |
| Pix payments            | Open finance / banking partners   | outbound/inbound | planned | Requires idempotency, signed webhooks, conciliation |
| Email/SMS notifications | TBD                               | outbound         | planned | Provider not selected                               |
| Object storage          | MinIO (dev), S3-compatible (prod) | outbound         | planned |                                                     |

Each integration must have:

- A spec in `docs/specs/`.
- Tenant-scoped configuration.
- Encrypted credentials at rest.
- Idempotency for mutating calls.
- Timeout, retry, and circuit breaker configuration.
- Audit logging.
