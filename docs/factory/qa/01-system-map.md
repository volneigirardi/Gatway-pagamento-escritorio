# System Map — QA Baseline

> Captured from source SHA `7a12564260bf9508f77b615fd74e6a2bcc8455d5` on 2026-08-30.
> This is a read-only baseline for the QA agent; it does not alter product code.

## 1. Repository Context

| Item            | Value                                      |
| --------------- | ------------------------------------------ |
| Repository      | `C:\Projeto-Saas` (local workspace)        |
| Branch          | `master`                                   |
| Source SHA      | `7a12564260bf9508f77b615fd74e6a2bcc8455d5` |
| Node.js         | `v24.18.0`                                 |
| pnpm            | `11.15.1`                                  |
| Package manager | `pnpm@11.15.1`                             |
| Monorepo        | pnpm workspaces + Nx                       |
| TypeScript      | strict (`5.9.3`)                           |

## 2. Deployables and Packages

### Deployables (`apps/*`)

| Deployable       | Tech                                                   | Purpose                                             | Status                            |
| ---------------- | ------------------------------------------------------ | --------------------------------------------------- | --------------------------------- |
| `apps/api`       | NestJS 11 + Fastify 5                                  | HTTP API                                            | Operational locally               |
| `apps/web`       | React 19 + Vite 8 + TanStack Router/Query + Tailwind 4 | Web frontend                                        | Operational locally               |
| `apps/worker`    | NestJS + BullMQ                                        | Background jobs (tenant provisioning, outbox relay) | Operational locally               |
| `apps/scheduler` | NestJS + BullMQ                                        | Scheduled jobs                                      | Operational locally               |
| `apps/realtime`  | NestJS + Socket.IO + Redis adapter                     | Realtime gateway                                    | Operational locally               |
| `apps/mobile`    | React Native 0.87 + Expo 57                            | Mobile app                                          | Placeholder / not fully harnessed |

### Shared Packages (`packages/*`)

| Package                                           | Purpose                                                     |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `@saas/auth`                                      | JWT, password (Argon2id), TOTP, session contracts           |
| `@saas/contracts`                                 | Zod DTOs shared between API, web, mobile                    |
| `@saas/database`                                  | Kysely helpers, connection manager, tenant context          |
| `@saas/database-migrations`                       | Kysely migrations and operational scripts                   |
| `@saas/outbox`                                    | Transactional outbox pattern                                |
| `@saas/http-client`                               | SSRF-safe outbound HTTP client                              |
| `@saas/webhooks`                                  | Signature sign/verify + delivery-with-dead-letter utilities |
| `@saas/observability`                             | OpenTelemetry, Pino, request context                        |
| `@saas/ui-web`                                    | Web component library (shadcn/ui-style Radix/Tailwind)      |
| `@saas/ui-native`                                 | Native component library                                    |
| `@saas/design-tokens`                             | Semantic tokens                                             |
| `@saas/api-client`                                | Generated API client                                        |
| `@saas/config`                                    | Environment hydration                                       |
| `@saas/testing`                                   | Shared test utilities                                       |
| `@saas/eslint-config` / `@saas/typescript-config` | Shared tooling                                              |

## 3. Runtime Stack

| Layer                                | Technology                                                                    | Notes                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Runtime                              | Node.js 24 LTS                                                                | Required by `engines`                                        |
| Backend framework                    | NestJS 11 with FastifyAdapter                                                 | `apps/api`, `apps/realtime`, `apps/worker`, `apps/scheduler` |
| Query builder                        | Kysely 0.29.5 + `pg` 8.23.0                                                   | Explicit SQL migrations; no ORM sync                         |
| Database                             | PostgreSQL 18.4 (target)                                                      | Database-per-tenant + central `saas-admin` catalog           |
| Cache / sessions / queues / realtime | Redis 7.4-alpine                                                              | BullMQ, Socket.IO adapter, throttler                         |
| Job queue                            | BullMQ 5.41.9                                                                 | Worker + scheduler                                           |
| Realtime                             | Socket.IO 4.8.3                                                               | JWT-authenticated handshake, `tenant:{id}` rooms             |
| Web build                            | Vite 8.2.1                                                                    | Route-based code splitting                                   |
| CSS                                  | Tailwind CSS v4.3.3                                                           | `@theme` / `@tailwind` warnings are known/non-blocking       |
| Auth                                 | RS256 access tokens, rotating refresh sessions in Redis, CSRF, Argon2id, TOTP | See ADR-008/015                                              |
| Observability                        | OpenTelemetry SDK + Pino + Prometheus/Grafana                                 | Real SDK wired                                               |
| Containers                           | Docker multi-stage; Docker Swarm / K8s manifests                              | All 6 images build after Fase 5 fixes                        |

## 4. Modules and Features

From `docs/module-catalog.md` and source inspection:

| Module         | Domain                                       | Status                                                       | Key Files                                                                                                        |
| -------------- | -------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `auth`         | Platform & tenant authentication             | Platform operational; tenant pending broader CRUD            | `apps/api/src/modules/auth`                                                                                      |
| `plans`        | SaaS plans and entitlements                  | Backend operational                                          | `apps/api/src/modules/plans`                                                                                     |
| `tenants`      | Tenant onboarding/catalog/provisioning       | Backend operational                                          | `apps/api/src/modules/tenants`, `apps/worker`                                                                    |
| `users`        | User management                              | Initial admin operational                                    | tenant migration `007_create_tenant_authorization.ts`                                                            |
| `teams`        | Teams and memberships                        | Planned                                                      | —                                                                                                                |
| `roles`        | RBAC                                         | Initial operational                                          | platform migration `007_create_platform_authorization.ts`, tenant migration `007_create_tenant_authorization.ts` |
| `audit`        | Audit logging                                | In implementation                                            | `platform_audit_logs` admin table, `audit_logs` tenant table                                                     |
| `reporting`    | Platform dashboard metrics                   | Backend operational                                          | `apps/api/src/modules/reporting`                                                                                 |
| `billing`      | Subscriptions, invoices, payments (internal) | Backend operational                                          | `apps/api/src/modules/billing`                                                                                   |
| `outbox`       | Transactional outbox                         | Shared package operational                                   | `packages/outbox`                                                                                                |
| `webhooks`     | Webhook signing/delivery utilities           | Shared package operational; subscription storage/API planned | `packages/webhooks`                                                                                              |
| `integrations` | External integration gateway                 | SSRF-safe client only; per-integration modules planned       | `packages/http-client`                                                                                           |
| `payments`     | Real Pix/card charging                       | Planned; only manual/internal records now                    | —                                                                                                                |
| `realtime`     | Realtime events                              | Gateway operational; business events planned                 | `apps/realtime`                                                                                                  |

## 5. Web Routes and Journeys

From `apps/web/src/main.tsx`:

| Route                     | Realm      | Purpose                 |
| ------------------------- | ---------- | ----------------------- |
| `/`                       | Public     | Home                    |
| `/login`                  | Public     | Unified login           |
| `/platform`               | `platform` | Dashboard index         |
| `/platform/plans`         | `platform` | Plans management        |
| `/platform/companies`     | `platform` | Tenant companies        |
| `/platform/subscriptions` | `platform` | Subscriptions           |
| `/platform/invoices`      | `platform` | Invoices                |
| `/platform/payments`      | `platform` | Payments                |
| `/platform/audit`         | `platform` | Audit logs              |
| `/platform/settings`      | `platform` | Platform settings       |
| `/app`                    | `tenant`   | Tenant dashboard        |
| `/app/settings`           | `tenant`   | Company settings        |
| `/app/subscription`       | `tenant`   | Subscription visibility |
| `/app/security`           | `tenant`   | Security settings       |

Critical user journeys for QA:

1. Anonymous user redirected to `/login`.
2. Platform owner logs in → MFA → `/platform` dashboard.
3. Platform owner creates plan → creates tenant → provisions database → creates initial admin.
4. Tenant admin logs in → changes temp password → enrolls MFA → enters `/app`.
5. Tenant admin updates company settings; platform admin views billing/reporting.

## 6. API Endpoints

From controller inspection (`apps/api/src/modules/**`):

### Auth (`/api/v1/auth`)

- `POST /login`
- `POST /password/change`
- `POST /mfa/setup`
- `POST /mfa/confirm`
- `POST /mfa/verify`
- `POST /mfa/recovery`
- `POST /refresh`
- `POST /logout`
- `GET /me` (bearer)

### Platform (`/api/v1/platform/*`)

- `GET /dashboard`
- `POST /tenants`, `GET /tenants`, `GET /tenants/:id`, `PATCH /tenants/:id/status`, `POST /tenants/:id/provisioning/retry`, `POST /tenants/:id/administrator`
- `POST /plans`, `GET /plans`, `GET /plans/:id`, `PATCH /plans/:id`, `POST /plans/:id/prices`
- `POST /billing/invoices`, `GET /billing/invoices`, `POST /billing/payments`, `GET /billing/payments`, `GET /billing/subscriptions`
- `GET /audit-logs`

### Tenant (`/api/v1/tenant/*`)

- `GET /overview`
- `GET /settings`
- `PUT /settings`

### Health (`/api/v1/health/*`)

- `GET /live`
- `GET /ready`

### Version

- `GET /api/v1/version`

All state-changing platform endpoints require `Idempotency-Key` header.

## 7. Database Schema

### Admin catalog migrations (`database/migrations/admin/`)

| Migration                                 | Tables / major changes                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `001_create_tenants.ts`                   | `tenants`                                                                                        |
| `002_create_identities.ts`                | `identities`, `mfa_factors`, `mfa_backup_codes`, trigger function                                |
| `003_create_platform_infrastructure.ts`   | `platform_audit_logs`, `platform_idempotency_keys`, `platform_outbox`                            |
| `004_create_plans.ts`                     | `plans`, `plan_prices`, `plan_features`                                                          |
| `005_expand_tenants_and_subscriptions.ts` | Expand `tenants`, add `tenant_provisioning_attempts`, `subscriptions`                            |
| `006_create_billing_records.ts`           | `invoices`, `invoice_items`, `payments`                                                          |
| `007_create_platform_authorization.ts`    | `platform_roles`, `platform_permissions`, `platform_identity_roles`, `platform_role_permissions` |
| `008_add_reporting_indexes.ts`            | Reporting indexes                                                                                |
| `009_fix_billing_residuals.ts`            | Billing residual fixes                                                                           |
| `010_harden_billing_residuals.ts`         | Hardened billing constraints/indexes                                                             |

### Tenant migrations (`database/migrations/tenant/`)

| Migration                            | Tables / major changes                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `001_create_outbox.ts`               | `outbox`                                                                                             |
| `002_create_idempotency_keys.ts`     | `idempotency_keys`                                                                                   |
| `003_create_audit_logs.ts`           | `audit_logs`                                                                                         |
| `004_tenant_isolation_and_audit.ts`  | RLS enablement, audit FKs                                                                            |
| `005_force_row_level_security.ts`    | `FORCE ROW LEVEL SECURITY` on tenant tables                                                          |
| `006_align_outbox_schema.ts`         | Outbox schema alignment                                                                              |
| `007_create_tenant_authorization.ts` | `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `company_settings` + RLS policies |

## 8. Roles and Permissions

### Platform (reserved)

- `platform_owner`: all platform permissions + MFA.
- `platform_admin`: future delegated operator.

Representative platform permissions:

- `platform:dashboard:read`
- `platform:plans:read`, `platform:plans:write`
- `platform:tenants:read`, `platform:tenants:write`
- `platform:billing:read`, `platform:billing:write`
- `platform:audit:read`
- `platform:settings:read`

### Tenant (reserved)

- `tenant_super_admin`: initial company administrator.
- `tenant_user`: future company user with assigned roles.

Representative tenant permissions:

- `company:read`, `company:update`
- `subscription:read`
- `security:read`

## 9. Integrations and External Touchpoints

| Integration           | Status                               | Notes                                      |
| --------------------- | ------------------------------------ | ------------------------------------------ |
| Webhooks (outbound)   | Utilities ready; storage/API planned | `@saas/webhooks`                           |
| External HTTP APIs    | SSRF-safe client only                | `@saas/http-client`                        |
| Pix/payment providers | Planned                              | No real charging yet                       |
| Email / notifications | Planned                              | No provider selected                       |
| WhatsApp              | Planned                              | —                                          |
| Storage               | MinIO in dev compose (`minio/minio`) | Object storage for future uploads/evidence |

## 10. Events / Queues

- `platform_outbox` admin table.
- `outbox` tenant table.
- BullMQ jobs: tenant provisioning (`apps/worker`), scheduled tasks (`apps/scheduler`).
- Socket.IO events: gateway ready; business-critical events not yet published.

## 11. Shared Risk Vectors

- `@saas/auth` — any defect impacts every realm.
- `@saas/database` connection manager / `app.current_tenant` — impacts all tenant isolation.
- `@saas/contracts` Zod schemas — single source of truth; drift breaks API/web/mobile.
- `@saas/outbox` — event loss affects provisioning and integrations.
- `apps/realtime` gateway — handshake/auth race conditions.
- Database migration scripts — run-time vs migration role separation (ADR-014).

## 12. Mobile

- `apps/mobile`: Expo 57, React Native 0.87, `expo-router`, `expo-secure-store`.
- Only placeholder test exists (`src/app/index.test.tsx`).
- E2E mobile harness pending; no Detox/Maestro configured yet.
- Native dependencies (`cpu-features`, `ssh2`) fail to build on Windows without Python; CI uses Linux runners.

## 13. Infrastructure / CI/CD

- GitHub Actions `.github/workflows/ci.yml`:
  - `quality-gates`: format, lint, typecheck, unit tests, build.
  - `security`: gitleaks secret scan, `pnpm audit`, Semgrep SAST, license checker.
  - `integration`: PostgreSQL + Redis service containers, migration up/down/up, API integration tests, worker integration test.
  - `e2e`: Playwright across Chromium/Firefox/WebKit/mobile viewport.
  - `containers`: build + Trivy scan + Syft SBOM for each deployable.
  - `manifests`: Kubernetes/Compose validation.
  - `openapi-contract`: placeholder until first versioned endpoints exist.
- Docker Compose dev: `infra/docker/docker-compose.dev.yml` (Postgres, Redis, MinIO, api, realtime, worker, scheduler, migrate/roles).
- Docker Compose prod and observability: separate files.
- Kubernetes base manifests: `infra/kubernetes/base`.

## 14. Known Pre-existing Defects (Baseline)

Documented here, not fixed in Part 1:

1. `pnpm format:check` fails on `.devin/scripts/auto-commit.js`.
2. `apps/api/test/admin-migrations.integration.spec.ts` expects `restored.results` length 6 but receives 5; likely test assertion bug.
3. Web build emits Tailwind v4 / lightningcss warnings; non-blocking.
4. Mobile test harness is placeholder; native deps fail on Windows.
5. Production database roles, secrets, TLS, and live K8s cluster remain untested/operator-managed.
