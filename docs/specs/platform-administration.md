# Platform Administration and Tenant Onboarding

## 1. Objective

Deliver the first operational Blupo business module: secure platform administration, tenant onboarding, plans, internal subscriptions/billing, management dashboards, and a basic tenant-administration portal.

## 2. Problem

The foundation has no real users, authentication endpoints, tenant provisioning, plan catalog, billing records, or management dashboard. Platform and tenant access must share one origin while remaining strictly separated on the backend.

## 3. Scope

- Fix PostgreSQL runtime-role isolation and prove RLS with a non-superuser role.
- Central identity directory with platform and tenant realms.
- Secure platform-owner bootstrap, password login, mandatory TOTP MFA, access/refresh lifecycle, logout, and session revocation.
- Platform RBAC and tenant RBAC with backend guards.
- Plan and versioned price/feature management.
- Tenant catalog, idempotent database provisioning, activation, suspension, and initial tenant superadministrator.
- Internal subscriptions, invoices, invoice items, and payment records in BRL.
- Platform dashboard with SaaS and billing indicators.
- Basic tenant portal for company profile, users, roles, security, and subscription visibility.
- Same-origin routing for web, API, and realtime under `app.blupo.com.br`.

## 4. Out of Scope

- Real card/Pix charging, acquiring, banking reconciliation, and provider webhooks.
- Email/SMS delivery, public password reset, SSO/SAML, and OAuth integrations.
- Platform support impersonation or unrestricted tenant-data bypass.
- Multiple tenant memberships for one email.
- Mobile administration and tenant business-domain modules.
- Production deployment.

## 5. Users

- `platform_owner`: reserved Blupo superadministrator with all platform permissions and mandatory MFA.
- `platform_admin`: future delegated platform operator with explicit permissions.
- `tenant_super_admin`: initial company administrator with company settings, users, roles, security, and subscription read access.
- `tenant_user`: future company user with assigned roles.

## 6. Flow

1. An operator bootstraps the first platform owner using an out-of-band secret.
2. The owner logs in, changes password when required, enrolls TOTP, and enters `/admin`.
3. The owner creates a plan and then a company with an idempotency key.
4. A transactional outbox event schedules tenant provisioning with a stable BullMQ job ID.
5. The worker creates the server-derived tenant database, applies migrations, and marks the tenant `pending_admin`.
6. The owner enters the customer email and temporary password. The identity service stores only Argon2id and creates the tenant superadministrator.
7. The tenant becomes active. The customer logs in through the same login page, changes the temporary password, enrolls MFA, and enters `/app`.
8. Platform billing records and dashboard metrics are maintained from persisted subscriptions, invoices, and payments.

## 7. Acceptance Criteria

- No default/plaintext credential exists in code, Git, logs, responses, or documentation.
- Runtime PostgreSQL role is not superuser, cannot bypass RLS, and is not a table owner.
- Tenant tokens receive 403 for every platform route, including direct requests with manipulated frontend state.
- Platform tokens do not gain implicit tenant-data access.
- A tenant cannot authenticate before successful provisioning and activation.
- Initial tenant password requires change and MFA before normal access.
- Duplicate/concurrent requests cannot create duplicate plans, tenants, identities, subscriptions, invoices, payments, jobs, or events.
- Dashboard values come from persisted records and use documented formulas.
- All critical actions are audit logged.
- Web screens comply with ADR-013 and WCAG 2.2 AA.

## 8. Business Rules

- Normalized email is globally unique.
- Money is stored as integer minor units; initial currency is BRL.
- Published plan prices are versioned. Plans referenced by subscriptions can be archived but not hard deleted.
- Financial records are voided/refunded with append-only history, not deleted.
- Tenant status transitions are allowlisted: `draft`, `provisioning`, `pending_admin`, `active`, `suspended`, `failed`, `archived`.
- Database identifiers are derived from UUIDs by server code and never accepted from client input.

## 9. Authorization

- Platform routes require `realm=platform`, `aud=blupo-platform`, and a platform permission.
- Tenant routes require `realm=tenant`, `aud=blupo-tenant`, signed `tid`, and tenant permission.
- Reserved permissions include platform dashboard, tenants, plans, billing, audit, and settings actions plus tenant company, users, roles, security, and subscription actions.
- Frontend roles are display hints only.

## 10. Multi-Tenancy

- One tenant database per company plus central control-plane catalog.
- Tenant identity is derived only from the verified JWT.
- Tenant repositories require `tenant_id` and execute with `app.current_tenant` set in a transaction.
- RLS is enabled and forced on every tenant table.
- Platform administrators do not receive a generic tenant bypass.

## 11. Data

Central catalog entities: identities, MFA factors, tenants, plans, plan prices/features, subscriptions, invoices/items, payments, provisioning attempts, platform audit, idempotency, and outbox.

Tenant entities: users, roles, permissions, role mappings, and company settings.

Sensitive values are minimized. TOTP secrets are AES-256-GCM encrypted; password and backup codes are Argon2id hashed; refresh tokens are hashed in Redis.

## 12. Migrations

Use explicit Kysely admin and tenant migrations with reversible `down` functions. Validate zero-to-latest, down, and up again against PostgreSQL 18. Role bootstrap is separate from schema migrations and is never run automatically against production.

## 13. API

Versioned `/api/v1` endpoints for auth, platform dashboard, plans, tenants/provisioning, billing, audit, company settings, users, roles, and subscription visibility. Contracts are strict Zod schemas in `@saas/contracts`; OpenAPI generates `@saas/api-client`. Large lists use cursor pagination and allowlisted filters/sorts. Mutations accept `Idempotency-Key`.

## 14. Realtime

No business-critical state depends on Socket.IO. Provisioning status initially uses query polling/refetch. A future version may publish validated progress events after persistence.

## 15. Web

One login page routes identities to a protected platform or tenant layout. Platform pages include dashboard, companies, plans, subscriptions, invoices, payments, audit, and settings. Tenant pages include overview, company, users, roles, security, and subscription.

Components follow shadcn/ui composition adapted to `@saas/ui-web`, semantic design tokens, Inter typography, responsive sidebar, accessible tables/forms/dialogs, and lazy-loaded Recharts charts.

## 16. Mobile

Out of scope for this delivery. Authentication contracts must remain usable by the future mobile client without cookie assumptions for mobile refresh storage.

## 17. Accessibility

Target WCAG 2.2 AA. All functionality is keyboard accessible; focus is visible and trapped/restored in overlays; fields have labels and associated errors; chart information has textual/table alternatives; color is never the only status signal.

## 18. Security

- Argon2id, RS256, TOTP MFA, refresh rotation/reuse detection, CSRF/Origin checks, strict cookies, generic login errors, and rate limits.
- Kysely bound parameters, strict Zod objects, allowlisted sort/update fields, and no dynamic identifiers from clients.
- BOLA and function-level authorization negative tests.
- Secrets split by runtime, migration, provisioning, JWT signing, cookie, and MFA encryption purpose.
- Audit authentication, privilege, tenant lifecycle, plan, subscription, invoice, and payment events without sensitive payloads.

## 19. Privacy

Apply LGPD data minimization. Restrict platform access to customer identity/contact data. Document retention for audit, billing, and deleted accounts before production. Do not expose personal data in metrics, logs, traces, or cache keys.

## 20. Observability

Emit structured logs, traces, and low-cardinality metrics for auth outcomes, lockouts, provisioning duration/failures, API latency, job retries, billing transitions, and dashboard query duration. Never use email, tenant name, token, or password as a metric label.

## 21. Performance

Use indexed aggregate queries over bounded date ranges, cursor pagination, batched reads, and route-level code splitting. Measure before adding dashboard cache; if needed, use a short Redis TTL with explicit invalidation. Recharts is loaded only with dashboard routes.

## 22. Tests

Unit tests for auth and financial formulas; integration tests with real PostgreSQL/Redis; migration/RLS/role tests; API authorization and injection tests; idempotency/concurrency/provisioning retry tests; Playwright user journeys across browsers; automated accessibility and visual snapshots.

## 23. Rollout

Deliver behind checkpoint gates: documentation, RLS roles, IAM, catalog/provisioning, billing, design system, web, same-origin infrastructure, and final security/quality review. Do not enable real tenant onboarding until all isolation and auth gates pass.

## 24. Rollback

Disable platform and tenant business routes while preserving data. Revoke runtime use of new credentials if a role issue appears. Do not automatically drop provisioned databases or delete financial/identity data. Use migration `down` only in disposable/non-production verification until release approval.

## 25. Risks

- Provisioner credential is privileged and requires strict isolation.
- A platform operator knows the temporary tenant password; mandatory immediate rotation and MFA mitigate but do not remove this weakness.
- Central identity compromise affects all accounts; least privilege, encryption, monitoring, MFA, and segmented secrets are mandatory.
- Internal billing is not proof of external settlement.
- The existing dirty worktree raises conflict risk and must be reviewed at each checkpoint.

## 26. Pending Decisions

- Select an email provider before implementing self-service password reset/invitations.
- Select a payment/Pix provider before external collection and reconciliation.
- Define production cloud/secrets manager and final tenant credential lifecycle before deployment.
