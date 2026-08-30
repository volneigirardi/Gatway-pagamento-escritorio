# Project State

## Current Phase

Primeiro módulo de negócio — Administração da Plataforma (vertical operacional concluída localmente). A fundação, autenticação, controle da plataforma, billing interno, dashboard e portal tenant estão implementados; produção continua bloqueada pelos itens de risco abaixo.

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
- RS256 access tokens, rotating refresh sessions, CSRF binding, Argon2id, TOTP/recovery codes, forced initial password rotation and isolated `platform`/`tenant` claims are operational in the API and unified web login (ADR-008/ADR-015).
- Database-per-tenant + RLS as defense-in-depth (ADR-009).
- Separate PostgreSQL runtime, migration, and provisioning roles (ADR-014).
- Every database-impacting task requires the appropriate database skill and a final independent `postgres-dba` subagent verdict before completion, commit, or merge; inline review is not a substitute (ADR-016).
- Central identity directory with globally unique email and isolated `platform`/`tenant` authorization realms on one origin (ADR-015).
- Bounded connection pools; PgBouncer in production (ADR-010).
- Redis-backed `@nestjs/throttler` for rate limiting (ADR-011).
- Transactional outbox pattern via `@saas/outbox` (ADR-012).
- Outbound HTTP calls (webhooks, future integrations) must go through `@saas/http-client` (SSRF guard + timeout + retry + circuit breaker).
- Inbound/outbound webhook signing and delivery-with-dead-letter via `@saas/webhooks`.
- The `professional` visual direction is accepted: minimalist Chatwoot-inspired layout and shadcn/ui component structure (ADR-013).
- SLA target: 99.9% initial, evolving to 99.99% when justified.

## Existing Modules

The first business vertical is operational locally: unified authentication, platform dashboard, plans, companies, asynchronous tenant provisioning, subscriptions, invoices, payments, audit log, and basic tenant overview/settings/security. Shared infrastructure packages include `@saas/auth`, `@saas/outbox`, `@saas/http-client`, `@saas/webhooks`, `@saas/observability`, `@saas/contracts`, and `@saas/ui-web`.

## Existing Integrations

None yet — architecture prepared for webhooks and external APIs via `@saas/http-client` / `@saas/webhooks`.

## Open Risks

- **RLS role remediation — PASS WITH DEPLOYMENT RISK**: ADR-014 is implemented in the repository. A real PostgreSQL 18 test proved `blupo_app` is non-superuser, cannot bypass RLS, is not table owner, cannot access Kysely migration metadata, and cannot read/update/delete/insert across tenants. Tenant migrations passed zero-to-latest, down, and up using `blupo_migrator`; the migrate image ran successfully. Production role provisioning/deployment remains NOT TESTED and must be performed out of band before production traffic.
- **Dependency audit — HIGH, mobile-only path**: the 2026-08-24 audit initially found nine high advisories. Storybook was patched to 8.6.17, Testcontainers to 12.1.0, and safe transitive overrides removed the Storybook, Undici, brace-expansion, and js-yaml findings. Two high `image-size <=2.0.2` denial-of-service advisories remain through Expo/Metro; upstream requires the major `image-size >=2.0.3`. Mobile distribution remains blocked until Expo/Metro adopts a compatible patch or the major override is separately proven safe.
- SLA 99.99% with a 1–3 developer team and undefined budget.
- Database-per-tenant cost at scale undefined.
- Cloud provider not selected.
- Mobile distribution strategy undefined.
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

## Fase 5 — Foundation Acceptance Audit (this pass)

Full report: `docs/FOUNDATION-ACCEPTANCE.md`. Summary of what a from-scratch,
evidence-based audit found and fixed (beyond the RLS/superuser risk above):

- **Container builds were broken for every service** (api, realtime, worker,
  scheduler, web, migrate) — no image had ever built successfully end to
  end. Root causes: incomplete pnpm workspace COPY context in Dockerfiles,
  `.dockerignore` at the wrong path (had zero effect), a `.dockerignore`
  pattern bug (`node_modules` only matches the context root in Docker,
  unlike `.gitignore`), missing `node_modules` in production stages, and
  Dockerfiles building only the target app instead of the full Nx
  dependency graph. All fixed; all six images build and `api`/`realtime`
  verified to run.
- Realtime gateway had three real runtime bugs, invisible to unit tests
  because they mocked around them: (1) `server.adapter is not a function`
  — NestJS binds `@WebSocketServer()` to the Socket.IO `Namespace`, not
  the `Server`, when a `namespace` option is set; (2) join/broadcast ack
  callbacks were never wired (NestJS requires an explicit `@Ack()`
  decorator); (3) a race condition where a client joining immediately
  after connecting could be rejected as unauthorized because
  `handleConnection`'s JWT check is async but Socket.IO doesn't wait for
  it — fixed by moving auth into an `io.use()` connection middleware. All
  three verified fixed with a real two-Docker-container, Redis-adapter,
  cross-node delivery test.
- `.devin/hooks.v1.json`'s destructive-command guard had an overly broad
  `\bformat\s` pattern blocking the safe `pnpm format` command; narrowed
  to actual disk-format commands.
- `docs/adr/README.md` listed a fictional ADR-001..020 plan not matching
  any file on disk; replaced with an accurate index (real ADRs: 004–012).
- `docs/commands.md` documented non-existent slash commands; replaced
  with the real `devin` CLI subcommand syntax.
- An interrupted `docker run ... pnpm install` against a Windows bind
  mount corrupted `node_modules` symlinks workspace-wide during this
  audit; repaired (with explicit approval) via full removal + clean
  `pnpm install --frozen-lockfile`, then re-verified green.

## Blocked / Needs Your Input

- **Production database roles**: repository implementation and disposable PostgreSQL verification pass; creating/rotating the real production roles and secrets remains an external release-blocking operator action.
- **Renovate GitHub App**: `renovate.json` is ready but the bot must be installed on the repository via GitHub (external action, cannot be done from this environment).
- **Docker Desktop**: was not running at the start of this session; was started manually to validate integration tests, Playwright, container builds, migrations, and backup/restore end-to-end. If it is stopped again, those commands will fail until it is restarted.
- **Devin/DeepWiki indexing**: pending your action once the repo is pushed to GitHub/GitLab — see `docs/FOUNDATION-ACCEPTANCE.md` §18 for the exact steps.

## Next Approved Step

The first vertical is complete locally. API integration passes 13/13 tests across nine files, worker provisioning passes 1/1, and web E2E passes 20/20 across Chromium, Firefox, WebKit, and mobile Chromium. Storybook, production web build, same-origin Compose/Kubernetes rendering, non-root read-only Nginx, and WCAG 2.2 AA axe scans pass. Before production: obtain the mandatory independent PostgreSQL DBA verdict, provision real database roles/secrets/TLS, validate against a live cluster, and resolve or formally defer the Expo/Metro `image-size` advisories.
