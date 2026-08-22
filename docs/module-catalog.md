# Module Catalog

> This catalog lists planned backend modules. Empty during foundation phase.

| Module       | Purpose                            | Status  | Notes |
| ------------ | ---------------------------------- | ------- | ----- |
| auth         | Authentication and authorization   | planned |       |
| tenants      | Tenant onboarding and catalog      | planned |       |
| users        | User management                    | planned |       |
| teams        | Teams and memberships              | planned |       |
| roles        | Roles and permissions              | planned |       |
| audit        | Audit logging                      | planned |       |
| outbox       | Transactional outbox               | planned |       |
| webhooks     | Webhook subscriptions and delivery | planned |       |
| integrations | External integration gateway       | planned |       |
| payments     | Pix and payment operations         | planned |       |
| billing      | Billing and subscriptions          | planned |       |
| realtime     | Realtime event publishing          | planned |       |

Each module must own its controllers, services, repositories, DTOs, and tests.
Modules must not depend directly on each other; communicate via domain events through the outbox.
