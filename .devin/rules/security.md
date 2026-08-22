---
description: "Security baseline for secrets, auth, encryption, and input validation"
trigger: always_on
---

# Security Rules

- No secrets in code, commits, logs, or comments.
- Passwords hashed with Argon2id. Sensitive data encrypted at rest with AES-256-GCM.
- JWT access tokens short-lived (15 min). Refresh tokens rotated and stored hashed in Redis.
- MFA via TOTP with backup codes.
- Validate all input with Zod at runtime; use generated types at compile time.
- No SQL string concatenation; use Kysely with bound parameters.
- Use TLS 1.3 in transit; mTLS for critical external integrations.
- Set security headers (HSTS, CSP, X-Content-Type-Options, etc.).
- CORS must be restrictive and environment-specific.
- Rate limit by IP and tenant.
- Scan dependencies before adding or upgrading; use only official registries and repositories.
- Security-sensitive changes require the `security-review` skill or `appsec-reviewer` subagent.
