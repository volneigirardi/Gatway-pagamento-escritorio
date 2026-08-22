# Security Requirements

## Baselines

- OWASP ASVS v4 (latest stable)
- OWASP Top 10 (latest)
- OWASP API Security Top 10 (latest)
- LGPD / GDPR principles (privacy by design)

## Principles

- Deny by default.
- Least privilege.
- Defense in depth.
- Secure by default.
- Privacy by design.

## Authentication

- Local email/password must use Argon2id.
- Access token JWT with 15 minutes expiry.
- Refresh token rotated, stored hashed in Redis, in HttpOnly Secure SameSite=Strict cookie on web.
- Mobile stores refresh token in secure system storage, access token in memory.
- MFA via TOTP with backup codes.
- Log all auth events to audit_logs.

## Authorization

- Backend is the source of truth.
- RBAC per tenant.
- ABAC only when justified and documented.
- Tenant context from JWT only.
- Object-level and function-level authorization.
- Negative tests for BOLA and cross-tenant access.

## API Security

- All input validated with Zod.
- Allowlist fields; reject unknown properties.
- Rate limiting per IP, tenant, and user.
- Request ID and trace ID in every request.
- Production errors without stack traces or internal details.
- CORS allowlist required in production.
- Versioned routes under `/api/v1/`.
- Idempotency-Key support for mutating endpoints.

## Web Security

- CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy.
- Cookies Secure, HttpOnly, SameSite=Strict, `__Host-` prefix when possible.
- CSRF protection for state-changing operations.
- No secrets in source maps or bundles.

## Mobile Security

- No secrets in bundle.
- Authorization Code + PKCE when using OAuth/OIDC.
- Biometric auth optional, never sole factor.
- Certificate pinning for critical integrations (future).

## Infrastructure Security

- Containers run non-root, read-only filesystem where possible.
- Base images pinned by digest.
- Secrets via environment variables or secrets manager; never in code.
- Network segmentation (frontend/backend/database networks).
- TLS 1.3 in transit; mTLS for sensitive internal integrations.

## Logging and Monitoring

- Never log passwords, tokens, full cookies, authorization headers, keys.
- Central redaction policy.
- Security events forwarded to SIEM.
- Alerts for brute force, privilege escalation, cross-tenant anomalies.

## Testing

- SAST/DAST in CI/CD.
- Dependency vulnerability scanning.
- Container scanning.
- Tenant isolation negative tests mandatory.
- Security regression tests for auth and authorization.
