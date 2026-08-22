# Project Context

## Product

A long-lived enterprise SaaS product targeting the regulated financial/fintech sector in Brazil. It is multi-tenant, supports companies, users, teams, roles, and permissions, and will integrate with external systems including Pix/payment providers.

## Domain

Financeiro / Fintech / Pix / Pagamentos.

## Why This Architecture

- A modular monolith provides clear boundaries without the operational overhead of microservices.
- Separate deployables allow independent scaling of API, workers, realtime, and scheduler.
- Database-per-tenant maximizes isolation required for financial data and LGPD.
- Kysely + `pg` keep SQL visible and reviewable.
- BullMQ + transactional outbox prevent event loss.
- Socket.IO with Redis adapter enables horizontal realtime scaling without making Socket.IO the source of truth.

## Target Scale

- Initially 1–3 developers.
- Foundation prepared for tens to hundreds of tenants; database-per-tenant model will be reviewed via ADR if scale exceeds ~100 active tenants.
- Web responsive for desktop/tablet; mobile app for iOS and Android.

## Compliance

- LGPD mandatory.
- Pix/payment integration requires idempotency, signed webhooks, immutable audit logs, and conciliation.
- Future certifications (PCI-DSS, SOC2) require additional ADRs.

## Key Decisions

See `docs/adr/` for Architecture Decision Records.

## Communication

- Technical identifiers (files, classes, tables, events, comments) in English.
- Explanations to non-technical stakeholders in Brazilian Portuguese.
