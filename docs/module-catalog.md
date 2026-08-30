# Module Catalog

> This catalog tracks implemented and planned modular-monolith domains.

| Module       | Purpose                             | Status                               | Notes                                                                                                                   |
| ------------ | ----------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| auth         | Authentication and authorization    | platform operational; tenant pending | Secure bootstrap, platform login, RS256, Argon2id, TOTP, refresh rotation/reuse revocation, CSRF, guards                |
| plans        | SaaS plans and entitlements         | backend operational                  | Idempotent CRUD, publication, versioned BRL prices and feature definitions                                              |
| tenants      | Tenant onboarding and catalog       | backend operational                  | Outbox/BullMQ database provisioning, retry, initial administrator and activation                                        |
| users        | User management                     | initial admin operational            | Initial tenant superadministrator; broader tenant user CRUD remains in implementation                                   |
| teams        | Teams and memberships               | planned                              |                                                                                                                         |
| roles        | Roles and permissions               | initial RBAC operational             | Reserved platform owner and tenant superadministrator; delegated-role CRUD remains in implementation                    |
| audit        | Audit logging                       | in implementation                    | Separate platform and tenant audit trails                                                                               |
| reporting    | Platform metrics and dashboard      | backend operational                  | MRR, ARR, churn, ARPA, companies, revenue, outstanding invoices and payment success                                     |
| outbox       | Transactional outbox                | shared package (`@saas/outbox`)      |                                                                                                                         |
| webhooks     | Webhook subscriptions and delivery  | shared package (`@saas/webhooks`)    | signature verify/sign + delivery with dead-letter implemented; subscription storage and API endpoints are still planned |
| integrations | External integration gateway        | shared package (`@saas/http-client`) | SSRF-safe client with timeout/retry/circuit breaker implemented; per-integration modules are still planned              |
| payments     | Pix and external payment operations | planned                              | Internal/manual payment records belong to billing in this phase; real provider integration is out of scope              |
| billing      | Billing and subscriptions           | backend operational                  | Internal subscriptions, invoices, payment records and audited/idempotent mutations; no external charging                |
| realtime     | Realtime event publishing           | planned                              |                                                                                                                         |

Each module must own its controllers, services, repositories, DTOs, and tests.
Modules must not depend directly on each other; communicate via domain events through the outbox.
