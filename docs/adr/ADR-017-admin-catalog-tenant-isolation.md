# ADR-017: Admin Catalog Tenant Isolation

## Status

Accepted (user approved)

## Context

ADR-009 mandates Row Level Security (RLS) as defense-in-depth on tenant data. The admin catalog (`invoices`, `invoice_items`, `payments`, etc.) contains `tenant_id` columns and is queried by platform services that operate exclusively within a single tenant context per request.

## Decision

The admin catalog tenant-scoped tables do not enable PostgreSQL RLS. Isolation is enforced by:

- `tenant_id` leading in every query (Kysely + application predicates).
- `tenant_id`-scoped unique constraints and composite foreign keys.
- `blupo_app` being a non-superuser, non-owner runtime role (`NOSUPERUSER NOBYPASSRLS`).
- Strict backend authorization that rejects cross-tenant resource access.

## Consequences

- Positive: avoids per-connection `app.current_tenant` management for a platform-only catalog, keeps reporting/cursor queries simple, and reduces RLS policy maintenance.
- Negative: a missing `tenant_id` predicate in a future code path could expose another tenant; all admin-catalog repositories must be audited for `tenant_id` filters.

## Related

- ADR-009 Tenant Isolation Strategy
- docs/security/tenant-isolation.md
- database/migrations/admin/006_create_billing_records.ts
