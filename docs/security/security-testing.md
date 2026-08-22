# Security Testing

## Automated in CI/CD

- Dependency vulnerability scan (`pnpm audit` + Snyk/Dependabot).
- Secret scan (gitleaks, truffleHog).
- SAST (Semgrep, CodeQL).
- Container scan (Trivy, Snyk).
- SBOM generation.

## Unit/Integration Tests

- Authentication: valid/invalid credentials, expired JWT, token rotation.
- Authorization: missing permission, cross-tenant access, object-level checks.
- Input validation: malformed payloads, injection attempts, mass assignment.
- Rate limiting: exceed threshold, reset window.
- Idempotency: duplicate keys, concurrent keys.
- Tenant isolation: negative tests with two tenants.

## Penetration Testing

- Annual third-party penetration test for regulated sectors.
- Focus on OWASP ASVS and API Security Top 10.

## Bug Bounty

- Consider public/private bug bounty after production launch.

## Acceptance Criteria

- No critical/high vulnerabilities in CI.
- Tenant isolation tests pass.
- Security headers verified.
- Secrets scan clean.
