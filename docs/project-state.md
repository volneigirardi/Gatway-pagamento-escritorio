# Project State

## Current Phase

Fase 4 — Hardening Enterprise e Quality Gates (concluída, incluindo Fase 4B: correção de gaps operacionais).

## Approved Architecture

- Modular monolith with separate deployables: `api`, `worker`, `realtime`, `scheduler`, `migrations`.
- Multi-tenancy: database-per-tenant with a central `saas-admin` catalog.
- Backend: NestJS + Fastify, Kysely + `pg`, PostgreSQL 18, Redis, BullMQ, Socket.IO.
- Web: React 19 + Vite + TanStack Router/Query + Tailwind v4 + Radix.
- Mobile: React Native + Expo (New Architecture, Hermes).
- Observability: OpenTelemetry (real SDK wired, OTLP export), Pino, Prometheus/Grafana.
- Infrastructure: Docker multi-stage, Docker Swarm, Kubernetes (base manifests), Traefik.

## Active Decisions

- Node.js 24 LTS, TypeScript strict, pnpm 11.
- pnpm workspaces + Nx for task graph and local cache. `database/` is now part of the workspace (was previously orphaned — fixed).
- JWT access/refresh tokens (`@saas/auth` `JoseJwtService`, HS256), RBAC per tenant, backend-only authorization (ADR-008).
- Database-per-tenant + RLS as defense-in-depth (ADR-009).
- Bounded connection pools; PgBouncer in production (ADR-010).
- Redis-backed `@nestjs/throttler` for rate limiting (ADR-011).
- Transactional outbox pattern via `@saas/outbox` (ADR-012).
- Outbound HTTP calls (webhooks, future integrations) must go through `@saas/http-client` (SSRF guard + timeout + retry + circuit breaker).
- Inbound/outbound webhook signing and delivery-with-dead-letter via `@saas/webhooks`.
- Three visual directions preserved in Storybook; design direction approval still pending.
- SLA target: 99.9% initial, evolving to 99.99% when justified.

## Existing Modules

None yet — foundation phase. Shared infrastructure packages exist: `@saas/auth`, `@saas/outbox`, `@saas/http-client`, `@saas/webhooks`, `@saas/observability` (with real OpenTelemetry).

## Existing Integrations

None yet — architecture prepared for webhooks and external APIs via `@saas/http-client` / `@saas/webhooks`.

## Open Risks

- SLA 99.99% with a 1–3 developer team and undefined budget.
- Database-per-tenant cost at scale undefined.
- Cloud provider not selected.
- Mobile distribution strategy undefined.
- Storybook visual direction must be approved before producing full component library.
- Native dependencies (cpu-features, ssh2) failed to build on Windows without Python; CI uses Linux runners.
- Kubernetes manifests (`infra/kubernetes/base`) were validated with `kubectl kustomize` only — never applied to a live cluster (none available in this environment).
- Multi-tenant migration orchestration (iterating every tenant database) is not automated; see `docs/database/migration-standards.md`.
- SSRF guard in `@saas/http-client` resolves DNS once before connecting (residual DNS-rebinding risk); acceptable until a real external integration is wired.
- Backup/restore encryption format buffers the whole dump in memory (no chunked streaming yet); fine for current scale, revisit before very large databases.

## Technical Debts

- `eslint-plugin-react` disabled in flat config because v7.37.5 is incompatible with the current ESLint flat setup.
- Web route tree is manually configured; file-based TanStack Router codegen can be added later.
- Mobile uses placeholder test setup; full Expo/RN test harness pending.
- Outbox relay worker not deployed as container yet.
- Native Argon2id dependency not installed; placeholder class provided in `@saas/auth`.
- Web build emits Tailwind v4 / lightningcss `@theme`/`@tailwind` warnings; non-blocking.
- Renovate config (`renovate.json`) is authored but the Renovate GitHub App/bot still needs to be enabled on the repository (external, manual step).
- `@saas/webhooks` implements signature verification and delivery-with-dead-letter as pure functions; subscription storage, delivery-log persistence, and API endpoints are still planned (business module).
- OpenAPI contract-diff CI job is a placeholder until the first versioned API endpoints exist (no baseline to diff against yet).

## Fase 4B — Gaps Found and Fixed (this pass)

Auditing the Fase 4 output surfaced several real bugs, now fixed and verified:

- `database/` was missing from `pnpm-workspace.yaml` — every `pnpm --filter @saas/database-migrations ...` command (docs, CI, scripts) was silently non-functional. Fixed; `database` now typechecks/lints as part of the workspace.
- `database/scripts/run-migrations.ts` imported `Migrator`/`FileMigrationProvider` from `kysely` instead of the `kysely/migration` subpath (moved in this Kysely version) — migrations could not run at all. Fixed, and added a Postgres advisory lock (prevents concurrent runs) and a `migrate:plan` dry-run command, matching what the docs already claimed.
- `docker-compose.prod.yml` referenced a `saas/migrate` image with no corresponding `Dockerfile.migrate`. Created.
- `apps/realtime` had no `/health` endpoint despite `docker-compose.*.yml` health-checking `http://localhost:3002/health` — the check would always fail. Added a real health module (liveness + Redis-backed readiness).
- The realtime gateway's JWT handshake check decoded the payload without verifying the signature (anyone could forge a token). Replaced with `@saas/auth`'s `JoseJwtService` (HS256, `jose`), plus added ack callbacks, per-socket rate limiting, and server-side event dedupe.
- `database/scripts/backup.ts` produced a plaintext, uncompressed `pg_dump` and named it `.sql.gz.enc` despite the security docs requiring encryption at rest. Implemented real AES-256-GCM + gzip; `restore.ts` now decrypts and verifies the auth tag fully **before** any SQL reaches `psql` (a streaming approach would let tampered/corrupted backups partially execute before the integrity failure surfaced). Verified end-to-end against a disposable PostgreSQL 18.4 container: backup → restore round-trip reproduces the source rows; wrong-key/tampered restore fails closed with zero statements executed.
- `apps/web/index.html` set `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`, and CSP `frame-ancestors` via `<meta http-equiv>` — browsers ignore all of these when delivered this way (confirmed via a new Playwright assertion). Removed the ineffective meta tags; `infra/docker/nginx.conf` (which already set most of these as real headers) now also sets `Content-Security-Policy`.
- `apps/web`'s `test:e2e` script existed but had no Playwright config or tests; the root `test:e2e` script also targeted the wrong Nx target name (`e2e` instead of `test:e2e`). Both fixed; added a 4-project (Chromium/Firefox/WebKit/mobile-Chrome) smoke suite and a CI job.
- CI's "secret scan" step ran `secretlint`, which was not even a project dependency, and swallowed all failures with `|| true` — it never actually scanned anything. Replaced with `gitleaks/gitleaks-action`, and added SAST (Semgrep), license check, container scanning (Trivy), SBOM generation (Syft), Kubernetes/Compose manifest validation, and a real Postgres/Redis-backed integration + migration-test job.
- Added `renovate.json` (dependency update automation was previously absent).

## Last Verification

2026-08-22 — Full quality gate re-run after Fase 4B fixes, with Docker available in this session (verified real Postgres/Redis-backed integration tests and a real backup/restore cycle, not just testcontainers scaffolding).

- `pnpm install` clean; lockfile passes supply-chain policies. Workspace now has 23 projects (was 20; added `database`, `@saas/http-client`, `@saas/webhooks`).
- `pnpm lint` passes for all 9 top-level projects and their 12 dependencies (mobile emits a harmless React Native parser warning from `node_modules`).
- `pnpm typecheck` passes for all 20 TypeScript projects.
- `pnpm test` passes across all packages/apps.
- `pnpm --filter @saas/api test:integration` passes against real Postgres 18.4 + Redis containers (tenant isolation, idempotency/outbox, concurrent transactions).
- `pnpm --filter @saas/web test:e2e` passes: 12/12 Playwright tests across Chromium, Firefox, WebKit, and a mobile viewport.
- `pnpm build` passes.
- `pnpm format:check` passes.
- Manual end-to-end backup/restore verification against a disposable PostgreSQL 18.4 container (see Fase 4B notes above).
- `kubectl kustomize infra/kubernetes/base` renders without error (no live cluster available to `apply` against in this environment).
- No business logic implemented; no push/deploy made; no commit made (blocked — see below).

## Blocked / Needs Your Input

- **Git identity not configured**: neither `git config user.name`/`user.email` (local) nor global config are set, and project rules forbid changing git config autonomously. No commit has been made in this repository yet (`git log` shows no commits on `master`). Please run:
  ```
  git config user.name "Your Name"
  git config user.email "you@example.com"
  ```
  so the working tree can be committed.
- **Renovate GitHub App**: `renovate.json` is ready but the bot must be installed on the repository via GitHub (external action, cannot be done from this environment).
- **Docker Desktop**: was not running at the start of this session; was started manually to validate integration tests, Playwright, and backup/restore end-to-end. If it is stopped again, `pnpm --filter @saas/api test:integration` and `pnpm --filter @saas/web test:e2e` will fail until it is restarted.

## Next Approved Step

Fase 4B report review, then Fase 5 planning (Prometheus/Grafana dashboards wiring, design direction approval, first business module — likely `tenants`/`auth`).
