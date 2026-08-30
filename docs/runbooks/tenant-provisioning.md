# Tenant Provisioning

## Purpose

Provision one isolated PostgreSQL database, run tenant migrations, create the initial tenant superadministrator, and activate the company through idempotent outbox/BullMQ workflows.

## Prerequisites

- ADR-014 roles are provisioned and verified.
- Admin catalog migrations are current.
- Worker receives runtime, migration, and provisioning secrets; API receives runtime credentials only.
- PostgreSQL role `blupo_provisioner` can create databases but cannot bypass RLS or access application tables.
- Worker and Redis are healthy.

## Procedure

1. A platform owner creates an active plan and price.
2. Create the company through `POST /api/v1/platform/tenants` with a unique `Idempotency-Key`.
3. Observe tenant status transition from `provisioning/queued` to `pending_admin/completed`.
4. If provisioning reaches `failed`, inspect the sanitized SQLSTATE/error code and use the audited retry endpoint. Do not manually create duplicate databases or jobs.
5. Create the initial administrator through `POST /api/v1/platform/tenants/{tenantId}/administrator` with a new idempotency key and temporary password.
6. Observe tenant transition to `active` and subscription transition from `pending` to `trialing` or `active`.
7. The customer logs in, rotates the temporary password, enrolls TOTP, and stores recovery codes before normal tenant access.

## Security Properties

- Database names are derived only from server-validated UUIDs (`tenant_<32 hex>`), never client identifiers.
- SQL identifiers use PostgreSQL `format('%I', $1::text)`; client strings are not concatenated into DDL.
- The provisioner secret is unavailable to API/web containers.
- Tenant migrations execute as `blupo_migrator`; business queries execute as `blupo_app` with `app.current_tenant` and explicit `tenant_id` predicates.
- Password plaintext is never written to outbox, job payload, audit, idempotency response, or log.
- Outbox event IDs become stable BullMQ job IDs, so relay retries do not duplicate work while explicit provisioning retries can create a new event/job.

## Verification

- Tenant row has `status=active`, `provisioning_status=completed`, and a server-derived database name.
- `tenant_provisioning_attempts` records successful completion.
- Tenant migrations are current.
- Runtime role can read only rows for the authenticated tenant.
- Exactly one initial user has role `tenant_super_admin` and the expected basic permissions.
- Central identity is pending password rotation/MFA until the customer's first login.
- Subscription is `trialing` when a future trial end exists, otherwise `active`.

Automated evidence:

```text
pnpm --filter @saas/worker test:integration
pnpm --filter @saas/api test:integration
```

## Retry and Recovery

The worker retries transient failures with exponential backoff. After attempts are exhausted, use the platform retry endpoint only after correcting the cause. Creation, migrations, grants, role/user mappings, settings, and activation are idempotent. Never drop a partially provisioned database automatically.

## Rollback

Suspend/disable the tenant and preserve its database, identity, audit, and billing records. Database deletion requires a separate compliance-approved destructive runbook and explicit authorization.

## Escalation

Escalate unexpected role privileges, RLS failure, repeated SQLSTATE errors, migration drift, duplicate identities, or any credential exposure to database and security owners before activation.

## References

- `docs/adr/ADR-009-tenant-isolation.md`
- `docs/adr/ADR-014-database-runtime-roles.md`
- `docs/adr/ADR-015-unified-identity-realms.md`
- `docs/specs/platform-administration.md`
