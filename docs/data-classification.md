# Data Classification

## Classification Levels

- **Public** — Can be shown without authentication (marketing pages, public status).
- **Internal** — System metadata not tied to a person or tenant (logs without identifiers, metrics).
- **Confidential** — Tenant-specific business data (invoices, products, configurations).
- **Restricted** — Personal data, credentials, financial transactions, health data.

## Handling Rules

- Restricted data must be encrypted at rest.
- Restricted data in transit requires TLS 1.3.
- Logs must not include secrets, tokens, or raw personal data.
- Audit logs are immutable and retained according to compliance requirements.
- Access to restricted data requires explicit authorization and is logged.
- Backup of restricted data must be encrypted.
