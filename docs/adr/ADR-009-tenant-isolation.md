# ADR-009: Tenant Isolation Strategy

## Status

Accepted

## Context

Strict tenant isolation is a compliance and trust requirement for financial/fintech SaaS.

## Decision

- Database-per-tenant with central admin catalog.
- `tenant_id` extracted from JWT claim `tid`, never from client input.
- Every query on tenant data includes `tenant_id` predicate.
- Row Level Security (RLS) policies enforce isolation at database level as defense-in-depth.
- Foreign keys and unique constraints scoped to `tenant_id` where applicable.

## Consequences

- Positive: strong isolation, audit-friendly, supports per-tenant backups.
- Negative: increases operational complexity; connection pool management more involved.

## Related

- docs/security/tenant-isolation.md
