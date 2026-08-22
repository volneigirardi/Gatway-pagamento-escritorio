# Authentication Strategy

## Overview

Authentication establishes identity. Multi-tenant authorization is handled separately (see `authorization.md`).

## Mechanisms

### Web

- Email + password (Argon2id).
- TOTP MFA with backup codes.
- Session: short-lived access token (JWT, 15 min) in memory; refresh token in HttpOnly Secure SameSite=Strict cookie.
- Token rotation on refresh.

### Mobile

- Email + password.
- Access token in memory.
- Refresh token in `expo-secure-store` / iOS Keychain / Android Keystore.
- Token rotation.

### API Integration (future)

- OAuth2 / OIDC client-credentials or authorization-code + PKCE.
- API keys scoped per tenant with rotation.

## JWT Claims

| Claim         | Meaning                   |
| ------------- | ------------------------- |
| sub           | User ID                   |
| tid           | Tenant ID                 |
| roles         | Array of role slugs       |
| permissions   | Array of permission slugs |
| jti           | Unique token ID           |
| iat, exp, nbf | Standard timestamps       |

## Password Policy

- Minimum 12 characters.
- Common-password blocklist.
- Argon2id with memory >= 19 MiB, iterations >= 2, parallelism >= 1.
- Rate limit login attempts.

## Reset Password

- Random token, hashed in DB, short expiry (15 min).
- Single-use.
- Verify email ownership before sending.

## Audit

Log to `audit_logs`: success, failure, MFA, logout, refresh, password reset, lockout.
