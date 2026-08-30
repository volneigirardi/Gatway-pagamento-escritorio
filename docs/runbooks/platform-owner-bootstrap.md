# Platform Owner Bootstrap

## Purpose

Create the first Blupo platform owner without a default or versioned credential.

## Prerequisites

- ADR-014 database roles and admin migrations are applied.
- Runtime `DATABASE_URL` uses `blupo_app` and does not expose migration/provisioning credentials.
- A unique owner email and random password of at least 12 characters are available through an approved secure channel.
- Argon2id parameters are configured for the target environment.

## Procedure

1. Supply `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD` as ephemeral secrets outside Git, shell history, process arguments, logs, and chat.
2. Supply runtime `DATABASE_URL` and Argon2id configuration.
3. Run `pnpm --filter @saas/api bootstrap:platform-admin` once.
4. Remove the bootstrap password from the environment/secrets staging location.
5. Sign in through the normal Blupo login screen.
6. Complete mandatory password rotation and TOTP enrollment before platform access.
7. Store the displayed recovery codes in an approved secure location.

The command is idempotent for the same owner and refuses to create a different second platform owner. It never prints the email, password, or password hash.

## Verification

Verify one active bootstrap identity and the reserved role without selecting the password hash:

```sql
SELECT i.id, i.status, i.must_change_password, i.mfa_required, r.slug
FROM identities i
JOIN platform_identity_roles ir ON ir.identity_id = i.id
JOIN platform_roles r ON r.id = ir.role_id
WHERE r.slug = 'platform_owner';
```

Expected before first login: one identity, reserved `platform_owner`, password rotation required, and MFA required.

After enrollment, verify login, `/api/v1/auth/me`, refresh rotation, logout, and relevant `platform_audit_logs` entries.

## Rollback

Do not delete the owner directly. Disable the identity and revoke all refresh families through the audited account-recovery procedure. Database-level repair requires security-owner approval.

## Escalation

Stop if another owner exists, an email conflict is reported, the runtime role lacks expected DML grants, or any credential appears in logs/output. Escalate to the security/database owner.

## References

- `docs/adr/ADR-015-unified-identity-realms.md`
- `docs/security/authentication.md`
- `docs/security/authorization.md`
- `docs/specs/platform-administration.md`
