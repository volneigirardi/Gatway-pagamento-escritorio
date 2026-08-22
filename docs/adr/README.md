# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records.

## Status

- **Proposed** — Under discussion.
- **Accepted** — Approved and active.
- **Deprecated** — Replaced by a newer ADR; kept for history.
- **Superseded** — Replaced by a newer ADR.

## Rules

- Each ADR is immutable once accepted.
- A new decision that overrides an old one must be a new ADR that references the old one.
- Never silently rewrite an accepted ADR.

## Planned ADRs

1. ADR-001 — Node.js 24 LTS + pnpm 11 + Nx
2. ADR-002 — Modular monolith architecture
3. ADR-003 — NestJS + Fastify
4. ADR-004 — Kysely + `pg` instead of ORM
5. ADR-005 — Database-per-tenant multi-tenancy
6. ADR-006 — Email/password + TOTP MFA
7. ADR-007 — JWT access + refresh tokens
8. ADR-008 — BullMQ for job queues
9. ADR-009 — Transactional outbox pattern
10. ADR-010 — Socket.IO + Redis adapter
11. ADR-011 — React 19 + Vite web stack
12. ADR-012 — React Native + Expo mobile stack
13. ADR-013 — Docker Swarm as first production platform
14. ADR-014 — Kubernetes as evolution target
15. ADR-015 — S3-compatible object storage abstraction
16. ADR-016 — OpenTelemetry + Pino observability
17. ADR-017 — Security baseline (Argon2id, AES-256-GCM, TLS, RLS)
18. ADR-018 — Immutable audit logs per tenant
19. ADR-019 — Pix/payment integration foundations
20. ADR-020 — Radix + Tailwind design system
