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

## Index (actual state, verified against `docs/adr/*.md` on disk)

| ADR     | Title                                                 | Status   |
| ------- | ----------------------------------------------------- | -------- |
| ADR-004 | Monorepo tooling                                      | Accepted |
| ADR-005 | Backend framework and runtime                         | Accepted |
| ADR-006 | Design system approach                                | Proposed |
| ADR-007 | Cache and cookie policy                               | Accepted |
| ADR-008 | Authentication and Authorization Strategy             | Accepted |
| ADR-009 | Tenant Isolation Strategy                             | Accepted |
| ADR-010 | Database Connection Pooling                           | Accepted |
| ADR-011 | Rate Limiting                                         | Accepted |
| ADR-012 | Transactional Outbox Pattern                          | Accepted |
| ADR-013 | Visual identity selection                             | Accepted |
| ADR-014 | PostgreSQL Runtime, Migration, and Provisioning Roles | Accepted |
| ADR-015 | Unified Identity Directory and Authorization Realms   | Accepted |
| ADR-016 | Mandatory PostgreSQL DBA Review Gate                  | Accepted |
| ADR-017 | Admin Catalog Tenant Isolation                        | Accepted |

## Known Gap (found during Fase 5 foundation audit)

`ADR-001` through `ADR-003` are referenced nowhere else in the repository,
but several decisions that would logically precede ADR-004 (Node.js/pnpm/Nx
choice, modular monolith shape, NestJS+Fastify) are already implemented and
documented informally in `AGENTS.md` and `docs/project-context.md` without a
corresponding ADR. This index previously listed a fictional ADR-001..020
plan that did not match any file on disk — that placeholder list has been
removed. Recommendation: backfill ADR-001..003 for the foundational
stack/architecture/framework decisions next time one of them needs to be
revisited, rather than leaving them undocumented as ADRs.
