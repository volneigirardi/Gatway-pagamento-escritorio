# Security Policy

## Scope

This policy applies to the SaaS enterprise foundation repository and all agents/humans working on it.

## Core Security Requirements

1. **Tenant Isolation**
   - Every business query must be scoped to a verified `tenant_id`.
   - Tenant identification must come from a trusted authentication context, never unvalidated client input.
   - Tenant isolation is enforced in the backend; frontend authorization is not sufficient.

2. **Secrets**
   - Secrets are never committed.
   - Secrets are injected at runtime via environment variables or a secrets manager.
   - Local `.env` files are gitignored.

3. **Authentication and Authorization**
   - Passwords hashed with Argon2id.
   - MFA via TOTP.
   - Short-lived access tokens (JWT) with refresh token rotation.
   - RBAC/ABAC enforced server-side.

4. **Data Protection
   - TLS 1.3 in transit.
   - Sensitive data encrypted at rest (AES-256-GCM for application data).
   - Audit logs immutable.

5. **Dependencies**
   - Only install from official registries.
   - Review advisories before adding or upgrading.
   - Pin exact versions and version the lockfile.

6. **Vulnerability Reporting
   - Report suspected vulnerabilities immediately to the project owner.
   - Do not disclose publicly before a fix is deployed.

7. **Compliance**
   - LGPD baseline applies.
   - Pix/payment integrations require idempotency, signed webhooks, and immutable logs.
   - Future certifications (PCI-DSS, SOC2) require additional review.

## Security Review

Use the `security-review` skill or `appsec-reviewer` subagent before merging security-sensitive changes.
