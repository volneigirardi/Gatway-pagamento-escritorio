# Incident Response

## Severity Levels

| Level | Example                                                 |
| ----- | ------------------------------------------------------- |
| SEV1  | Data breach, full outage, cross-tenant leak             |
| SEV2  | Significant functionality degraded, suspected intrusion |
| SEV3  | Minor security issue, isolated bug                      |
| SEV4  | Near miss, improvement opportunity                      |

## Response Steps

1. **Detect** — monitoring, alert, or report.
2. **Contain** — isolate affected component, revoke tokens, block IPs.
3. **Eradicate** — remove root cause, patch, rotate secrets.
4. **Recover** — restore services from verified backups.
5. **Learn** — post-mortem, update runbooks, add tests.

## Communication

- Internal: incident commander, engineering, legal, executive.
- External: customers (if data affected), regulators (LGPD/GDPR within 72h if applicable).

## Forensics

- Preserve logs, snapshots, audit logs.
- Do not destroy evidence.
- Chain of custody for backups.

## Runbooks

- Database compromise.
- JWT key compromise.
- Cross-tenant data leak suspicion.
- DDoS.
- Ransomware.

## Review

Update this document and runbooks after every SEV1/SEV2 incident.
