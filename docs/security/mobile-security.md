# Mobile Security

## Token Storage

- Access token: memory only.
- Refresh token: `expo-secure-store` (iOS Keychain / Android Keystore).
- No tokens in AsyncStorage or unencrypted storage.

## Authentication

- Email/password + TOTP MFA baseline.
- Biometric auth optional, never sole factor.
- OAuth2/OIDC with PKCE when applicable.

## Bundle

- No secrets, API keys, or backend credentials in bundle.
- Use runtime configuration from secure backend.
- Enable code obfuscation and minification for release builds.

## Network

- TLS 1.3, certificate pinning for critical integrations (future).
- Validate TLS certificates; do not allow custom trust stores without review.

## Deep Links

- Validate deep link data before acting.
- Do not trust deep links for sensitive actions without backend confirmation.

## Logging

- Do not log tokens, PII, or request bodies in release builds.
- Disable React Native debug logs in production.
