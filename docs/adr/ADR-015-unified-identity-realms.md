# ADR-015: Unified Identity Directory and Authorization Realms

## Status

Accepted

## Context

Blupo needs one public origin (`app.blupo.com.br`) and one email/password login experience for both platform operators and tenant users. A tenant user must never gain platform-management access by manipulating routes, frontend state, JWT payloads, or direct HTTP requests. Database-per-tenant also requires a deterministic way to resolve an email to its tenant before opening a tenant connection.

## Decision

Store authentication identities in the central administrative catalog and require a globally unique normalized email during the initial product phase.

Each identity belongs to one authorization realm:

- `platform`: Blupo operators. Tokens use `realm=platform`, audience `blupo-platform`, and contain no tenant claim.
- `tenant`: company users. Tokens use `realm=tenant`, audience `blupo-tenant`, and contain the signed `tid` claim.

The login endpoint validates the identity and returns the appropriate realm so the web application can route to `/admin` or `/app`. Frontend routing is not authorization. Backend route namespaces use independent guards:

- `/api/v1/platform/*` accepts only valid platform-audience tokens and explicit platform permissions.
- `/api/v1/tenant/*` accepts only valid tenant-audience tokens, derives `tenant_id` from the signed token, and enforces tenant permissions and object-level checks.

Platform identities cannot implicitly enter a tenant realm, and tenant identities cannot call platform routes. Support impersonation and administrative tenant bypass are out of scope.

Credentials use Argon2id. Access tokens follow ADR-008 and use RS256 with issuer/audience validation. Web refresh tokens are opaque, rotated, hashed in Redis, and transported only in a Secure HttpOnly SameSite=Strict cookie. TOTP MFA is mandatory for the platform owner and for an initial tenant superadministrator before normal access.

A tenant administrator password supplied during onboarding is temporary: the API hashes it immediately, never logs or echoes it, and restricts the identity to password change and MFA enrollment until both are complete.

## Consequences

- Positive: the login form remains email/password only and works on one domain.
- Positive: authorization realms are cryptographically and server-side separated.
- Positive: login can resolve the tenant before tenant-database access.
- Negative: the central catalog contains password hashes for all identities and therefore requires strong least privilege, encryption controls, monitoring, and backup protection.
- Negative: global email uniqueness prevents one identity from joining multiple tenants until a future ADR introduces memberships/account selection.
- Negative: platform and tenant authorization matrices, token audiences, and negative tests must be maintained separately.

## Rollback

The login UI can be disabled behind configuration while preserving identities. Realm claims and route guards cannot be rolled back to frontend-only checks. Any future multi-tenant membership model requires a superseding ADR and migration.

## Related

- ADR-008: Authentication and Authorization Strategy
- ADR-009: Tenant Isolation Strategy
- ADR-014: PostgreSQL Runtime, Migration, and Provisioning Roles
- `docs/security/authentication.md`
- `docs/security/authorization.md`
