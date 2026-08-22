# Project State

## Current Phase

Fase 4 — Hardening Enterprise e Quality Gates (concluída).

## Approved Architecture

- Modular monolith with separate deployables: `api`, `worker`, `realtime`, `scheduler`, `migrations`.
- Multi-tenancy: database-per-tenant with a central `saas-admin` catalog.
- Backend: NestJS + Fastify, Kysely + `pg`, PostgreSQL 18, Redis, BullMQ, Socket.IO.
- Web: React 19 + Vite + TanStack Router/Query + Tailwind v4 + Radix.
- Mobile: React Native + Expo (New Architecture, Hermes).
- Observability: OpenTelemetry, Pino, Prometheus/Grafana.
- Infrastructure: Docker multi-stage, Docker Swarm, Kubernetes/Helm, Traefik.

## Active Decisions

- Node.js 24 LTS, TypeScript strict, pnpm 11.
- pnpm workspaces + Nx for task graph and local cache.
- JWT access/refresh tokens, RBAC per tenant, backend-only authorization (ADR-008).
- Database-per-tenant + RLS as defense-in-depth (ADR-009).
- Bounded connection pools; PgBouncer in production (ADR-010).
- Redis-backed `@nestjs/throttler` for rate limiting (ADR-011).
- Transactional outbox pattern via `@saas/outbox` (ADR-012).
- Three visual directions preserved in Storybook; design direction approval still pending.
- SLA target: 99.9% initial, evolving to 99.99% when justified.

## Existing Modules

None yet — foundation phase.

## Existing Integrations

None yet — architecture prepared for webhooks and external APIs.

## Open Risks

- SLA 99.99% with a 1–3 developer team and undefined budget.
- Database-per-tenant cost at scale undefined.
- Cloud provider not selected.
- Mobile distribution strategy undefined.
- Storybook visual direction must be approved before producing full component library.
- Native dependencies (cpu-features, ssh2) failed to build on Windows without Python; CI uses Linux runners.
- Docker images and production Compose were not deployed; only local testcontainers integration tests were executed.

## Technical Debts

- `@fastify/helmet` and `@fastify/compress` are now wired (Fase 4).
- `eslint-plugin-react` disabled in flat config because v7.37.5 is incompatible with the current ESLint flat setup.
- Web route tree is manually configured; file-based TanStack Router codegen can be added later.
- Mobile uses placeholder test setup; full Expo/RN test harness pending.
- Outbox relay worker not deployed as container yet.
- Native Argon2id dependency not installed; placeholder class provided in `@saas/auth`.
- Prometheus/OpenTelemetry instrumentation still pending (skeleton via observability package).

## Last Verification

2026-08-15 — Fase 4 quality gates completed.

- `pnpm install` clean with lockfile passing supply-chain policies.
- `pnpm lint` passes for all projects (mobile emits harmless React Native parse warning in node_modules).
- `pnpm typecheck` passes for all 17 TypeScript projects.
- `pnpm test` passes (unit/smoke tests for all packages and apps).
- `pnpm --filter @saas/api test:integration` passes using testcontainers (PostgreSQL + Redis), covering tenant isolation, idempotency/outbox, and concurrent transactions.
- `pnpm build` passes.
- `pnpm format:check` passes.
- Security docs, database docs, performance docs created.
- `.env.example`, CI/CD workflow, Swarm production compose, backup/restore scripts created.
- Web build emits Tailwind v4 / lightningcss warnings; these are non-blocking and tracked in technical debt.
- No business logic implemented; no push/deploy made.

## Next Approved Step

Fase 4A — User review of Fase 4 report and pending decisions (Prometheus/OpenTelemetry instrumentation, design direction approval, first business module).
