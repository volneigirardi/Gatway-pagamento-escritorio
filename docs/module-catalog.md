# Module Catalog

> This catalog lists planned backend modules. Empty during foundation phase.

| Module       | Purpose                            | Status                               | Notes                                                                                                                   |
| ------------ | ---------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| auth         | Authentication and authorization   | planned                              |                                                                                                                         |
| tenants      | Tenant onboarding and catalog      | planned                              |                                                                                                                         |
| users        | User management                    | planned                              |                                                                                                                         |
| teams        | Teams and memberships              | planned                              |                                                                                                                         |
| roles        | Roles and permissions              | planned                              |                                                                                                                         |
| audit        | Audit logging                      | planned                              |                                                                                                                         |
| outbox       | Transactional outbox               | shared package (`@saas/outbox`)      |                                                                                                                         |
| webhooks     | Webhook subscriptions and delivery | shared package (`@saas/webhooks`)    | signature verify/sign + delivery with dead-letter implemented; subscription storage and API endpoints are still planned |
| integrations | External integration gateway       | shared package (`@saas/http-client`) | SSRF-safe client with timeout/retry/circuit breaker implemented; per-integration modules are still planned              |
| payments     | Pix and payment operations         | planned                              |                                                                                                                         |
| billing      | Billing and subscriptions          | planned                              |                                                                                                                         |
| realtime     | Realtime event publishing          | planned                              |                                                                                                                         |

Each module must own its controllers, services, repositories, DTOs, and tests.
Modules must not depend directly on each other; communicate via domain events through the outbox.
