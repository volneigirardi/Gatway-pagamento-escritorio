# ADR-008: Authentication and Authorization Strategy

## Status

Accepted

## Context

Multi-tenant enterprise SaaS requires trusted identity, tenant scoping, and least-privilege access.

## Decision

- JWT access tokens (RS256, 15 min) with refresh token rotation.
- Refresh token in HttpOnly Secure SameSite=Strict cookie on web; secure storage on mobile.
- RBAC per tenant with explicit permission grants.
- Backend-only authorization decisions; frontend receives hints only.
- Argon2id for local passwords; TOTP MFA with backup codes.

## Consequences

- Positive: standard, scalable, auditable, supports horizontal scaling.
- Negative: requires key rotation strategy and careful refresh token storage.

## Related

- docs/security/authentication.md
- docs/security/authorization.md
