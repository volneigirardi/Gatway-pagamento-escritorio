---
description: "Authentication and authorization implementation rules"
trigger: model_decision
---

# Authentication and Authorization Rules

- Authenticate users with email/password + TOTP MFA as baseline. SSO/SAML is an enterprise add-on.
- Issue access token JWT and refresh token on successful authentication.
- Access token contains `sub`, `tid`, `roles`, and `permissions`.
- Refresh token for web lives in HttpOnly Secure SameSite=Strict cookie; for mobile in secure system storage.
- Implement RBAC with roles and permissions stored per tenant.
- Use ABAC only when a static role is insufficient; document the rule.
- Guards must reject requests before business logic runs.
- Never trust client-provided tenant or role claims beyond the signed JWT.
- Log authentication events (success, failure, MFA, logout, token refresh) in `audit_logs`.
