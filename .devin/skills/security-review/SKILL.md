---
name: security-review
description: Review changes for security issues
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Review changes for security issues using OWASP ASVS, OWASP Top 10, and OWASP API Security Top 10 as baselines.

1. Check authentication, authorization, session, and token handling.
2. Check tenant isolation and BOLA (Broken Object Level Authorization).
3. Check input validation, injection risks, mass assignment, file uploads.
4. Check secrets handling, logging of sensitive data, and encryption.
5. Check CORS, CSRF, XSS, SSRF, and rate limiting.
6. Check dependency supply chain and configuration.
7. Report findings classified as critical/high/medium/low/informational with file references.

Do not modify code unless explicitly instructed.
