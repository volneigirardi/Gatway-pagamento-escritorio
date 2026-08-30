# Authentication Strategy

## Overview

Authentication establishes identity. Multi-tenant authorization is handled separately (see `authorization.md`).

## Mechanisms

### Web

- Email + password (Argon2id).
- TOTP MFA with backup codes.
- Session: short-lived RS256 access token (15 min) in memory; opaque refresh token in an HttpOnly Secure SameSite=Strict cookie.
- Refresh tokens are rotated, stored only as SHA-256 hashes in Redis, and revoked as a family when reuse is detected.
- A high-entropy CSRF synchronizer token is bound by hash to each refresh session and atomically verified during rotation/logout.
- Password-change and MFA challenges are opaque, short-lived, stored by hash, and single-use.
- Issuer, audience, key ID, algorithm, realm, and runtime claim schemas are verified before authentication is accepted.

### Mobile

- Email + password.
- Access token in memory.
- Refresh token in `expo-secure-store` / iOS Keychain / Android Keystore.
- Token rotation.

### API Integration (future)

- OAuth2 / OIDC client-credentials or authorization-code + PKCE.
- API keys scoped per tenant with rotation.

## JWT Claims

| Claim         | Meaning                                       |
| ------------- | --------------------------------------------- |
| sub           | User ID                                       |
| realm         | `platform` or `tenant`                        |
| tid           | Tenant ID; required only for the tenant realm |
| roles         | Array of role slugs                           |
| permissions   | Array of permission slugs                     |
| jti           | Unique token ID                               |
| iss, aud      | Verified issuer and realm-specific audience   |
| iat, exp, nbf | Standard timestamps                           |

## Password Policy

- Minimum 12 characters.
- Common-password blocklist.
- Argon2id with memory >= 19 MiB, iterations >= 2, parallelism >= 1.
- Rate limit login attempts.
- Tenant onboarding passwords are temporary; normal access is denied until password rotation and MFA enrollment complete.

## Reset Password

- Random token, hashed in DB, short expiry (15 min).
- Single-use.
- Verify email ownership before sending.

## Audit

Platform authentication events are appended to `platform_audit_logs`; tenant-domain events use tenant `audit_logs`. Record success, failure, lockout, password rotation, MFA, refresh/reuse, logout, and recovery without passwords, tokens, raw cookies, TOTP secrets, recovery codes, or email addresses in metadata.
