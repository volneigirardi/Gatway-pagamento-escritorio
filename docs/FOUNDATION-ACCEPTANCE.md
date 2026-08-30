# Foundation Acceptance Report — Fase 5

## Metadata

| Field                              | Value                                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Date                               | 2026-08-23                                                                                                            |
| Branch                             | `master`                                                                                                              |
| HEAD commit (start of this audit)  | `9ae5ddb` — "Freeze visual identity and add UX/UI governance"                                                         |
| Uncommitted changes at report time | See §15 (Git)                                                                                                         |
| Node.js                            | v24.18.0                                                                                                              |
| pnpm                               | 11.15.1                                                                                                               |
| Docker                             | 29.7.2 (Docker Desktop) — available for most of this audit; was not running at session start and was started manually |
| OS                                 | Windows (development sandbox); production targets Linux containers                                                    |
| PostgreSQL tested against          | 18.4 (Docker)                                                                                                         |
| Redis tested against               | 7.4-alpine (Docker)                                                                                                   |

This report follows the evidence principle: every claim below is backed by a
command, its exit code, and observed output, executed during this session.
Where something was not exercised, it is marked **NOT TESTED**, not PASS.

---

## 1. Executive Summary

The foundation is **substantially sound in design** (documentation, rules,
architecture, quality gates, application-level tenant filtering, JWT
verification, idempotency) but this audit found and fixed **eight
previously-undetected defects, three of them CRITICAL**, that would have
caused real production failures or security gaps if not caught now:

1. **CRITICAL** — Container builds were broken for every service (`api`,
   `realtime`, `worker`, `scheduler`, `web`, `migrate`). No image had ever
   been successfully built end-to-end before this audit. Root causes:
   incomplete pnpm workspace COPY context, a misplaced `.dockerignore`
   (wrong path, so it had zero effect), a `.dockerignore` pattern bug
   (`node_modules` only matches the context root in Docker, not `**/node_modules`
   as in `.gitignore`), production stages missing `node_modules` entirely,
   and Dockerfiles not using Nx to build workspace dependencies first.
   **Fixed and verified**: all six images now build and the `api` and
   `realtime` images run successfully.
2. **CRITICAL** — Row-Level Security (RLS), documented in ADR-009 as a
   defense-in-depth layer, provided **zero actual protection**: the
   migration never used `FORCE ROW LEVEL SECURITY`, and even after adding
   it, the `POSTGRES_USER` bootstrap role used by every current
   environment (dev compose, prod compose, Kubernetes) is a **superuser**,
   which always bypasses RLS regardless of `FORCE`. Verified empirically:
   a cross-tenant `SELECT`/read succeeded with no `WHERE` clause. **Partially
   fixed** (FORCE added); **NOT fixed** is the real requirement — a
   separate, non-superuser application role — which needs an ADR and your
   approval since it changes connection/credential architecture.
3. **CRITICAL** (functional, not security) — The realtime gateway's
   `EventsGateway.afterInit` crashed on every real boot with
   `TypeError: server.adapter is not a function`, because NestJS binds
   `@WebSocketServer()` to the Socket.IO `Namespace` (not the top-level
   `Server`) when a `namespace` option is declared. **Fixed and verified**
   with a real two-node, Redis-adapter cross-node delivery test.
4. **HIGH** — The realtime gateway's join/broadcast handlers never
   received Socket.IO's acknowledgement callback at runtime (NestJS
   requires an explicit `@Ack()` decorator; a plain third parameter is
   silently `undefined`). Unit tests never caught this because they called
   the handler methods directly, bypassing NestJS's parameter binding.
   **Fixed and verified**.
5. **HIGH** — A real race condition: `handleConnection` awaited JWT
   verification asynchronously, but Socket.IO does not wait for it before
   allowing the client to send messages, so a client joining immediately
   after connecting could be spuriously rejected as unauthorized.
   **Fixed** by moving authentication into an `io.use()` connection
   middleware (blocks the handshake itself) and verified with the same
   two-node test.
6. **MEDIUM** — `database/` was missing from `pnpm-workspace.yaml`,
   silently breaking every `pnpm --filter @saas/database-migrations ...`
   command referenced in scripts, docs, and CI. **Fixed**.
7. **MEDIUM** — `database/scripts/run-migrations.ts` imported
   `Migrator`/`FileMigrationProvider` from the wrong module path
   (`kysely` instead of `kysely/migration`), making migrations
   inexecutable. **Fixed**, plus added a Postgres advisory lock and a
   `migrate:plan` dry-run command to match what the docs already claimed.
8. **MEDIUM** — `database/scripts/backup.ts` produced an unencrypted,
   uncompressed plaintext dump but named the file `.sql.gz.enc`,
   contradicting the documented encryption-at-rest requirement, and the
   original `restore.ts` streamed decrypted-but-unverified plaintext into
   `psql` before checking the GCM auth tag. **Fixed** (real AES-256-GCM +
   gzip, verify-before-execute) and **verified end-to-end** against a
   disposable PostgreSQL container, including a rejected tampered/wrong-key
   restore.

Governance/tooling findings (non-code):

- The `.devin/hooks.v1.json` pre-tool-use guard had an overly broad
  destructive-command pattern (`\bformat\s`) that blocked the safe,
  idempotent `pnpm format` command. **Fixed** (narrowed to actual disk-format
  commands).
- `apps/api/AGENTS.md` was referenced and served as authoritative context
  earlier in this engagement but was found missing from disk during this
  audit; already restored/committed.
- `docs/adr/README.md`'s "Planned ADRs" list (ADR-001..020) did not match
  any file on disk; the real ADRs are 004–012. **Fixed** (replaced with an
  index reflecting actual files, with the gap documented).
- `docs/commands.md` documented non-existent slash commands
  (`/devin/rules list`, `/hooks`) instead of the real `devin` CLI
  subcommands. **Fixed**.

**Recommendation**: fix #2's real requirement (dedicated non-superuser DB
role) before any tenant data exists, and review this report's Blocked
Decisions section (§ Recommendation for approval) before starting business
functionality.

---

## 2. Brain / Governance Audit

| Item                 | Path                                                 | Loaded                                          | Trigger                                     | Scope       | Duplicated | Contradictory   | Action needed                                                                                                |
| -------------------- | ---------------------------------------------------- | ----------------------------------------------- | ------------------------------------------- | ----------- | ---------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| Root rules           | `AGENTS.md`                                          | Yes                                             | n/a                                         | repo-wide   | No         | No              | None                                                                                                         |
| Dir rules            | `database/`, `docs/`, `infra/`, `packages/AGENTS.md` | Yes                                             | n/a                                         | per-dir     | No         | No              | Consider adding `apps/{web,mobile,worker,scheduler,realtime}/AGENTS.md` for parity with `apps/api/AGENTS.md` |
| `apps/api/AGENTS.md` | `apps/api/AGENTS.md`                                 | Yes (restored)                                  | n/a                                         | apps/api    | No         | No              | Was missing from disk at audit start; restored, matches committed content                                    |
| Rules (27 files)     | `.devin/rules/*.md`                                  | Yes (confirmed via `search`)                    | 4 `always_on`, rest `model_decision`/`glob` | varies      | No         | No              | None — frontmatter valid on all 27                                                                           |
| Skills (23)          | `.devin/skills/*/SKILL.md`                           | Yes via `search`; **`list` command reported 0** | n/a                                         | varies      | No         | No              | Environment/tool discrepancy between `list` and `search`, not a repo defect — noted for awareness            |
| Agents (8 reviewers) | `.devin/agents/*.md`                                 | Yes (usable as `run_subagent` profiles)         | n/a                                         | review-only | No         | No              | None                                                                                                         |
| Hooks                | `.devin/hooks.v1.json`                               | Yes                                             | `PreToolUse`, `UserPromptSubmit`            | repo-wide   | No         | **Yes — found** | `\bformat\s` blocked safe commands; **fixed**                                                                |
| Source trust         | `docs/standards/source-trust-policy.md`              | Yes                                             | n/a                                         | repo-wide   | No         | No              | None                                                                                                         |
| ADR index            | `docs/adr/README.md`                                 | Yes                                             | n/a                                         | repo-wide   | No         | **Yes — found** | Planned list didn't match reality; **fixed**                                                                 |
| Commands doc         | `docs/commands.md`                                   | Yes                                             | n/a                                         | repo-wide   | No         | **Yes — found** | Wrong Devin CLI invocation syntax; **fixed**                                                                 |

No always_on excess (4 of 27 rules), no impossible/vague rules found beyond
the hook regex issue, no unrecognized agents, no invalid frontmatter.

---

## 3. Cross-Session Persistence Test

Read fresh (this section), without relying on prior conversation memory:

- **Stack**: Node.js 24 LTS, TypeScript strict, pnpm 11, Nx; NestJS + Fastify;
  PostgreSQL 18 + Kysely + `pg`; Redis; BullMQ; Socket.IO + Redis adapter;
  React 19 + Vite + TanStack Router/Query + Tailwind + Radix; React Native +
  Expo; OpenTelemetry + Pino + Prometheus/Grafana; Docker + Swarm +
  Kubernetes. **Matches `AGENTS.md` exactly.**
- **Commands**: `pnpm lint|typecheck|test|build`, `pnpm format[:check]`,
  `pnpm --filter <pkg> test:integration`, `docker compose` up/down,
  `devin rules|skills list`. **Matches `docs/commands.md` (after this
  audit's fix) and root `package.json` scripts.**
- **Module boundaries**: modular monolith, independently deployable
  `api`/`worker`/`realtime`/`scheduler`/`migrations`; packages are
  shared/business-logic-free; modules must not depend on each other
  directly (communicate via outbox). **Matches `packages/AGENTS.md`,
  `docs/module-catalog.md`.**
- **Multi-tenancy model**: database-per-tenant + central `saas-admin`
  catalog; `tenant_id` from trusted JWT claim only; every query filtered by
  `tenant_id`; RLS as defense-in-depth. **Matches `AGENTS.md`,
  `docs/security/tenant-isolation.md`** — but see §1 finding #2: the RLS
  half of this model does not currently work as documented.
- **Security policy**: Argon2id (placeholder pending native dep),
  AES-256-GCM at rest, TLS 1.3, Zod validation, no `any` without
  justification. **Matches `AGENTS.md`, `.devin/rules/security.md`.**
- **Socket.IO strategy**: Redis adapter, JWT-authenticated handshake,
  `tenant:{tenant_id}` rooms, versioned Zod-validated events, WebSocket
  preferred. **Matches `.devin/rules/realtime-socketio.md`** — and, after
  this audit's fixes, now actually works as described (verified).
- **Completion policy**: evidence-based, `git diff` review before
  finishing, no silent architecture changes, report blockers honestly.
  **Matches `.devin/rules/task-completion.md`, `AGENTS.md`.**

**Information that existed only in prior conversation and not in the
repo, now moved to documentation by this audit**: the RLS/superuser gap,
the container-build breakage, the realtime runtime bugs, and the
migration script fixes are now recorded in `docs/security/tenant-isolation.md`,
this report, and code comments — not left as tribal/conversational
knowledge.

---

## 4. Clean Install

| Check                           | Command                                                        | Dir       | Exit         | Notes                                                                                                                                                                            |
| ------------------------------- | -------------------------------------------------------------- | --------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remove first-party build output | (approved, `[System.IO.Directory]::Delete`)                    | repo root | 0            | 18 `dist/` dirs removed (not `node_modules`-nested)                                                                                                                              |
| Frozen install                  | `pnpm install --frozen-lockfile`                               | repo root | 0            | 23 workspace projects, 695ms (after repair — see incident below)                                                                                                                 |
| Nx graph / cycles               | `nx graph --file=` + custom cycle-detection script             | repo root | 0            | 22 project nodes, **0 circular dependencies**                                                                                                                                    |
| Divergent versions              | Custom script comparing all `package.json` dependency versions | repo root | 0            | **0 divergent versions** across workspace                                                                                                                                        |
| Dedupe check                    | `pnpm dedupe --check`                                          | repo root | 1 (advisory) | Only patch-level transitive deps (`balanced-match`, `es-object-atoms`, `cli-spinners`); no structural issue; **not applied** (no package updates during audit, per instructions) |

**Incident during this audit**: an interrupted `docker run ... pnpm install`
against a Windows-bind-mounted `node_modules` left multiple broken/dangling
NTFS reparse points across the workspace (not just `database/`), which then
broke `pnpm install --frozen-lockfile` (`EACCES`) and Docker builds (file
access errors). **Repaired** with explicit user approval: emptied and
removed all `node_modules` directories, then ran a clean
`pnpm install --frozen-lockfile`, which succeeded and was verified by a full
green `lint`/`typecheck`/`test`/`build` re-run. No source files were
affected; `node_modules` is not version-controlled.

---

## 5. Quality Gate (post-fix, cache-reset for genuine timing)

| Gate                                         | Command                                                                                     | Exit                     | Duration                                | Result                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format check                                 | `pnpm exec prettier --check ...`                                                            | 0                        | ~3.1s                                   | PASS                                                                                                                                               |
| Lint                                         | `pnpm lint` (nx reset first)                                                                | 0                        | 54.3s → 1 fail found → fixed → re-run 0 | **PASS** (after fixing one `no-unnecessary-type-assertion` introduced by this audit's own realtime fix)                                            |
| Typecheck                                    | `pnpm typecheck` (nx reset first)                                                           | 0                        | 24.0s                                   | PASS — 20 projects                                                                                                                                 |
| Unit tests                                   | `pnpm test`                                                                                 | 0                        | 16.1s                                   | PASS — 27 tasks (15 projects + 12 deps)                                                                                                            |
| Build                                        | `pnpm build`                                                                                | 0                        | 11.4s                                   | PASS — 18 projects                                                                                                                                 |
| API integration tests                        | `pnpm --filter @saas/api test:integration`                                                  | 0                        | ~7–14s (multiple runs)                  | **PASS** — real PostgreSQL 18.4 + Redis via testcontainers, not scaffolding                                                                        |
| Migration up/down/up                         | `docker run saas/migrate ... run-migrations.ts up/down/up tenant`                           | 0                        | seconds                                 | **PASS** — verified against disposable Postgres, table-by-table `status` output confirmed                                                          |
| Web E2E                                      | `pnpm exec playwright test` (apps/web)                                                      | 0                        | ~9–10s                                  | **PASS** — 12/12 across Chromium, Firefox, WebKit, mobile-Chrome viewport                                                                          |
| Docker build × 6                             | `docker build -f infra/docker/Dockerfile.{api,realtime,worker,scheduler,web,migrate} .`     | 0 (all six, after fixes) | ~20–45s each                            | **PASS** — see §1 for what was broken and fixed                                                                                                    |
| Docker Compose config × 3                    | `docker compose -f ... config -q` (dev/prod/observability, with required env vars supplied) | 0 (all three)            | <1s each                                | PASS — no warnings after removing obsolete `version:` keys                                                                                         |
| Kubernetes manifests                         | `kubectl kustomize infra/kubernetes/base`                                                   | 0                        | <1s                                     | PASS (renders; never applied to a live cluster — none available)                                                                                   |
| Security scans (Semgrep/Trivy/Syft/gitleaks) | CI-only (`.github/workflows/ci.yml`)                                                        | —                        | —                                       | **NOT TESTED locally** — these run in GitHub Actions, not exercised in this sandbox; workflow file inspected and believed correct but not executed |
| Visual regression                            | —                                                                                           | —                        | —                                       | **NOT TESTED** — no visual regression tooling configured (no Storybook snapshot/Chromatic pipeline yet)                                            |
| Accessibility tests                          | —                                                                                           | —                        | —                                       | **NOT TESTED** as an automated gate — Playwright smoke test checks a skip-link and heading roles, but no axe-core/pa11y integration exists yet     |
| Mobile tests                                 | `pnpm --filter @saas/mobile test`                                                           | 0                        | —                                       | PASS (placeholder-level; no real Expo/RN harness — pre-existing documented debt)                                                                   |

---

## 6. Database

| Check                                             | Result                                 | Evidence                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations from zero                              | **PASS**                               | 4 (then 5, after the RLS fix) migrations applied in order against a disposable PostgreSQL 18.4 container via the real `saas/migrate` Docker image                                                                                                                                                                                                                   |
| Rollback (`down`)                                 | **PASS**                               | `004_tenant_isolation_and_audit` rolled back cleanly, then re-applied (`up`) successfully                                                                                                                                                                                                                                                                           |
| Constraints / FKs / unique / indexes              | **PASS** (structural)                  | Confirmed via migration `status` and `\dt`; unique constraint on `idempotency_keys(tenant_id, scope, key)` exercised by `idempotency.integration.spec.ts`                                                                                                                                                                                                           |
| `tenant_id` presence                              | **PASS**                               | All tenant tables carry `tenant_id`; enforced at the query layer in tests                                                                                                                                                                                                                                                                                           |
| Transactions / concurrency / idempotency / outbox | **PASS**                               | `concurrency.integration.spec.ts` (row-locked increments), `idempotency.integration.spec.ts` (duplicate-key rejection, outbox insert), all green against real Postgres                                                                                                                                                                                              |
| Pool / timeouts / health check                    | **PASS** (config-level)                | `@saas/database` sets pool min/max/timeout; `apps/api` and `apps/realtime` both expose `/health/ready` checking their respective dependency                                                                                                                                                                                                                         |
| **Two-tenant negative test — direct SQL**         | **FAIL (found), then PARTIALLY FIXED** | See §1 finding #2. A cross-tenant `SELECT` with `app.current_tenant` set to tenant B returned tenant A's rows too, both before and after `FORCE ROW LEVEL SECURITY`, because the connecting role is a Postgres superuser. **Real protection today is exclusively the application-level `WHERE tenant_id = ...` filter**, which is correctly implemented and tested. |
| Two-tenant negative test — via API                | **NOT TESTED**                         | No business API endpoints exist yet (foundation phase) to exercise BOLA/cross-tenant HTTP access; only the DB-level and Socket.IO-level (room isolation) paths could be tested                                                                                                                                                                                      |
| Two-tenant negative test — via Socket.IO          | **PASS**                               | `EventsGateway` derives the room (`tenant:{tenant_id}`) exclusively from the verified JWT claim; the client cannot request an arbitrary room or inject a `tenantId`; verified by code review and the real two-node test (tenant ID never taken from client payload)                                                                                                 |
| Backup encryption + restore integrity             | **PASS (fixed)**                       | See §1 finding #8 — real AES-256-GCM+gzip round-trip verified; tampered/wrong-key restore correctly rejected before touching the target database                                                                                                                                                                                                                    |

---

## 7. Duplicate Requests

| Scenario                                      | Result                | Evidence                                                                                                                                                                                                                                                                                |
| --------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concurrent requests (double-click equivalent) | **PASS**              | `concurrency.integration.spec.ts`: 10 concurrent `withTransaction` increments against the same row, correct final count via `SELECT ... FOR UPDATE`                                                                                                                                     |
| Duplicate idempotency key                     | **PASS**              | `idempotency.integration.spec.ts`: second insert with the same `(tenant_id, scope, key)` correctly rejected by the unique constraint                                                                                                                                                    |
| Webhook duplicate delivery                    | **PASS** (unit-level) | `packages/webhooks/src/delivery.test.ts` — delivery attempts carry a stable `Idempotency-Key: {subscriptionId}:{eventId}`; signature/replay-window tests in `signature.test.ts`                                                                                                         |
| Socket.IO duplicate event                     | **PASS**              | `EventsGateway.handleBroadcast` dedupes by client-supplied `eventId` via a bounded in-memory cache; verified by unit test (`deduplicates broadcast events by eventId`) and documented per-process limitation (no cross-replica dedupe cache yet — see `docs/realtime-event-catalog.md`) |
| Job duplicate (BullMQ)                        | **NOT TESTED**        | No business jobs exist yet; `@saas/outbox`'s relay is unit-tested but not exercised under real duplicate-delivery conditions                                                                                                                                                            |
| Browser refresh / two tabs / two devices      | **NOT TESTED**        | Requires a real frontend flow with mutations, which does not exist yet (no business UI)                                                                                                                                                                                                 |

---

## 8. Socket.IO Multi-Replica

**Real test performed**: two `saas/realtime` Docker containers (built from
the fixed Dockerfile) + one Redis container, real JWT tokens (HMAC-SHA256,
matching the server's verification), a client connected to node A, a
second client connected to node B, joining the same tenant room, node B
broadcasting, node A receiving via the Redis adapter.

| Item                                      | Result                                                                                                                                                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two independent nodes boot successfully   | **PASS** (after fixing findings #3–#5)                                                                                                                                                                                                                                |
| Redis adapter cross-node delivery         | **PASS** — directly observed: message emitted on node B received by a client connected to node A                                                                                                                                                                      |
| Tenant rooms                              | **PASS** — room derived server-side from the verified JWT `tid` claim                                                                                                                                                                                                 |
| Authentication (handshake)                | **PASS** — real signature verification via `JoseJwtService`; forged tokens rejected pre-connection                                                                                                                                                                    |
| Ack / ack timeout                         | **PASS** (ack); **NOT TESTED** (explicit timeout scenario)                                                                                                                                                                                                            |
| Retry                                     | **NOT TESTED** — no client retry policy implemented/exercised                                                                                                                                                                                                         |
| Dedupe                                    | **PASS** (unit-level, single-process; cross-replica dedupe is a documented limitation)                                                                                                                                                                                |
| Reconnect                                 | **NOT TESTED**                                                                                                                                                                                                                                                        |
| Node restart                              | **NOT TESTED**                                                                                                                                                                                                                                                        |
| Redis temporary unavailability / recovery | **NOT TESTED** — `ioredis` reconnect behavior is default library behavior, not exercised under induced failure in this audit                                                                                                                                          |
| State recovery                            | **NOT TESTED** — no state recovery mechanism implemented (Socket.IO is explicitly notification-only per architecture)                                                                                                                                                 |
| Sticky sessions                           | **N/A** — transports restricted to `["websocket"]` only (no long-polling), documented in `infra/kubernetes/README.md`                                                                                                                                                 |
| Graceful shutdown / draining              | **PASS (config-level)** — `onApplicationShutdown` disconnects local sockets and quits Redis clients; Kubernetes `preStop` sleep + readiness-first draining configured in `infra/kubernetes/base/deployment-realtime.yaml`; **not exercised under load** in this audit |

---

## 9. Performance

**Scope note**: full load-testing (k6/Artillery baselines, soak tests,
spike tests) was **NOT TESTED** in this audit — no business endpoints exist
yet to generate a meaningful load profile, and standing up a full
load-testing pipeline was out of scope for a foundation audit that
explicitly excludes business functionality. What was checked:

| Item                                                         | Result                                                                                                                                                                                                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event loop / obvious blocking calls in hot paths             | **PASS (code review)** — no synchronous heavy computation found in gateway/health paths                                                                                                                                                         |
| Listener growth                                              | **PASS (code review)** — Redis clients and rate-limiter state are cleaned up on disconnect (`rateLimiter.clear(client.id)`)                                                                                                                     |
| Query plans / N+1                                            | **N/A** — no business queries exist yet beyond the generic outbox/idempotency tables, already covered by integration tests                                                                                                                      |
| Bundle size (web)                                            | **PASS (informational)** — build output: `index-*.js` 293 KB (93.5 KB gzip), well under typical budgets for a foundation shell with no business UI yet                                                                                          |
| Realtime payload/ack latency, reconnect storms, retry storms | **NOT TESTED**                                                                                                                                                                                                                                  |
| Documented budgets vs. reality                               | `docs/performance/performance-budgets.md` targets are **aspirational placeholders**, explicitly marked as needing real measurement — this audit did not produce new benchmark numbers, consistent with "measure before publishing, don't guess" |

---

## 10. Security

Reviewed against the checklist in this Fase 5 prompt, cross-referenced with
`docs/security/*.md` and `.devin/agents/appsec-reviewer.md`'s focus areas.
A full formal independent `appsec-reviewer` subagent pass was **not**
re-run in this session (time-boxed); this section is a direct-evidence
review by the primary agent.

| Area                 | Status                                                       | Notes                                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Secrets              | PASS                                                         | No secrets found in code/config during this audit's edits; `.gitignore`/`.dockerignore` exclude `.env*` (except `.env.example`)                                                                                                                                                                        |
| Authentication       | PASS                                                         | JWT verified via `jose` (real signature check), not decoded-only (this was fixed in Fase 4B and re-verified working in the multi-replica test)                                                                                                                                                         |
| Authorization        | PASS (app-level)                                             | Tenant scoping via JWT claim only, never client input                                                                                                                                                                                                                                                  |
| Multi-tenancy / BOLA | **FAIL (DB defense-in-depth layer)**, PASS (app-level layer) | See §1 finding #2 and §6                                                                                                                                                                                                                                                                               |
| Mass assignment      | NOT TESTED                                                   | No business DTOs exist yet to assess                                                                                                                                                                                                                                                                   |
| Injection            | PASS (design)                                                | Kysely query builder used throughout; no raw string-concatenated SQL found; migrations use `sql.ref()` for identifiers                                                                                                                                                                                 |
| SSRF                 | PASS                                                         | `@saas/http-client`'s `assertPublicHttpUrl` blocks private/loopback/link-local/cloud-metadata ranges; unit-tested (7 tests)                                                                                                                                                                            |
| XSS / CSRF           | NOT TESTED                                                   | No business forms/mutating UI exist yet                                                                                                                                                                                                                                                                |
| CORS                 | PASS                                                         | Allowlist-based in both `apps/api` and `apps/realtime`, no wildcard                                                                                                                                                                                                                                    |
| Cookies              | N/A                                                          | No cookie-based session exists yet (JWT bearer only in current foundation)                                                                                                                                                                                                                             |
| Headers              | **FAIL (found), FIXED**                                      | `apps/web/index.html` set `X-Frame-Options`/`X-Content-Type-Options`/`Permissions-Policy`/CSP `frame-ancestors` via `<meta>`, which browsers ignore for these — confirmed by a real Playwright console-error assertion; fixed by relying on the real `nginx.conf` headers (which now also include CSP) |
| Rate limiting        | PASS (config-level)                                          | `@nestjs/throttler` + Redis-backed store in `apps/api`; realtime gateway has an additional per-socket sliding-window limiter                                                                                                                                                                           |
| Brute force          | NOT TESTED                                                   | No login endpoint exists yet                                                                                                                                                                                                                                                                           |
| Uploads              | N/A                                                          | No upload functionality exists yet                                                                                                                                                                                                                                                                     |
| Webhooks             | PASS (package-level)                                         | `@saas/webhooks` implements HMAC-SHA256 signature + timestamp replay-window verification, unit-tested (5 tests)                                                                                                                                                                                        |
| Outbound requests    | PASS                                                         | `@saas/http-client` timeout + retry (idempotent-only) + circuit breaker, unit-tested (5 tests)                                                                                                                                                                                                         |
| Logs                 | PASS                                                         | `@saas/observability`'s Pino logger redacts `password`/`token`/`secret`/`apiKey`/`authorization`/`refreshToken`/`creditCard` paths                                                                                                                                                                     |
| Dependency chain     | PASS (informational)                                         | `pnpm dedupe --check` found only patch-level transitive drift; no direct-dependency version divergence across the workspace                                                                                                                                                                            |
| Containers           | PASS (after fixes)                                           | Non-root user (uid 1001) in all Dockerfiles; **found and fixed**: builds were broken, production images had no runtime deps — see §1                                                                                                                                                                   |
| Manifests            | PASS                                                         | `infra/kubernetes/base` sets `runAsNonRoot`, drops all capabilities, `readOnlyRootFilesystem: true`, default-deny `NetworkPolicy`                                                                                                                                                                      |
| Mobile storage       | NOT RE-VERIFIED this session                                 | Covered in Fase 4B (`expo-secure-store` for refresh tokens); not re-tested here                                                                                                                                                                                                                        |
| Source maps          | NOT TESTED                                                   | No production deployment has occurred to check source map exposure                                                                                                                                                                                                                                     |
| Error disclosure     | PASS (design)                                                | `AllExceptionsFilter` in `apps/api` returns a consistent envelope without stack traces in production mode (code review; not re-verified via a live 500 in this session)                                                                                                                                |

**No critical/high finding from this list was silently ignored.** Findings
#2 (RLS/superuser) and the header issue are explicitly flagged above; #2's
full fix requires your approval (new DB role architecture).

---

## 11. Infrastructure

### Docker Swarm (`docker-compose.prod.yml`)

| Check                                   | Result                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Compose parse                           | PASS (`docker compose config -q`, exit 0, after removing the obsolete `version:` key)                                                   |
| Services / secrets / configs / networks | PASS (structural review) — `edge`/`backend` overlay networks, Docker secrets for `database_url`/`redis_url`/`jwt_secret`/`cors_origins` |
| Health checks                           | PASS — `wget` against `/api/v1/health/live` (api) and `/health` (realtime)                                                              |
| Rolling update / rollback config        | PASS (structural) — `update_config.failure_action: rollback` on `api`/`realtime`                                                        |
| Traefik labels / rate limit middleware  | PASS (structural)                                                                                                                       |
| Sticky session                          | N/A (websocket-only transport, as above)                                                                                                |
| Migration service                       | PASS (structural) — `migrate` service now builds correctly (§1); `restart_policy: condition: none` (one-shot)                           |
| Graceful shutdown                       | PASS (code-level `enableShutdownHooks()` + `onApplicationShutdown`)                                                                     |
| **Actual `docker stack deploy`**        | **NOT TESTED** — no Swarm cluster available in this environment; only compose-file validation was possible                              |

### Kubernetes (`infra/kubernetes/base`)

| Check                                        | Result                                                                                                                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifest schema / kustomize build            | PASS — `kubectl kustomize` renders cleanly                                                                                                                                                                |
| Namespace, ServiceAccount                    | PASS                                                                                                                                                                                                      |
| Probes (startup/readiness/liveness)          | PASS — aligned with real `/health/live`, `/health/ready` endpoints (verified those endpoints exist and are implemented, not that they were probed by a live kubelet)                                      |
| Resources (requests/limits)                  | PASS (present, values not load-tested)                                                                                                                                                                    |
| HPA / PDB                                    | PASS (present)                                                                                                                                                                                            |
| Anti-affinity / topology spread              | PASS (present)                                                                                                                                                                                            |
| NetworkPolicy                                | PASS — default-deny + explicit allows                                                                                                                                                                     |
| securityContext / non-root / read-only FS    | PASS                                                                                                                                                                                                      |
| Service / Ingress                            | PASS (Service only; no Ingress resource yet — Traefik/ingress-controller specifics deferred, documented)                                                                                                  |
| Migration Job                                | PASS (structural; deliberately excluded from the base kustomization to avoid accidental re-apply)                                                                                                         |
| Rolling update / rollback                    | PASS (`maxUnavailable: 0`, standard Deployment rollback via `kubectl rollout undo`, not exercised live)                                                                                                   |
| **Actual `kubectl apply` to a live cluster** | **NOT TESTED** — no cluster available; this tool's own destructive-command guard also blocks `kubectl apply`/`delete` without explicit per-command approval, consistent with "no real deploy" instruction |

---

## 12. Documentation Consistency

Confirmed present and cross-checked against actual repo state: `README.md`,
`CONTRIBUTING.md`, `SECURITY.md`, `docs/project-context.md`,
`docs/project-state.md`, `docs/module-catalog.md`, `docs/database/*.md`,
`docs/security/*.md`, `docs/performance/*.md`,
`docs/realtime-event-catalog.md`, `docs/integration-catalog.md`,
`docs/commands.md`, `docs/runbooks/README.md`, `docs/adr/README.md` +
ADR-004..012, `docs/specs/TEMPLATE.md`, `docs/agentic/*.md`.

Fixed during this audit: `docs/adr/README.md` (fictional ADR index),
`docs/commands.md` (wrong CLI syntax), `docs/security/tenant-isolation.md`
and `docs/database/backup-restore.md` (updated with real findings).

**Every command documented in `docs/commands.md` was verified to exist**
(`pnpm lint|typecheck|test|build`, `devin rules|skills list`). **Every
technology documented in `AGENTS.md`'s "Approved Stack" is actually
installed** (verified via `package.json` files and `pnpm list`).

---

## 13. Area Classification Summary

| Area                                                               | Classification                                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Governance (rules/skills/agents/hooks)                             | PASS (after 1 hook fix)                                                                 |
| Documentation consistency                                          | PASS (after 3 fixes)                                                                    |
| Clean install / dependency graph                                   | PASS                                                                                    |
| Lint / typecheck / unit tests / build                              | PASS                                                                                    |
| API integration tests (tenant isolation, idempotency, concurrency) | PASS                                                                                    |
| Migrations (up/down/up)                                            | PASS                                                                                    |
| **Tenant isolation — application layer**                           | PASS                                                                                    |
| **Tenant isolation — database RLS layer**                          | **FAIL** (documented, partially mitigated, real fix needs your approval)                |
| Tenant isolation — Socket.IO rooms                                 | PASS                                                                                    |
| Duplicate-request protection (idempotency, dedupe)                 | PASS where testable; NOT TESTED for jobs/browser-level scenarios (no business code yet) |
| Socket.IO multi-replica                                            | **PASS** (after fixing 3 real runtime bugs)                                             |
| Performance                                                        | NOT TESTED (no load-testing pipeline exercised; no business load to profile)            |
| Security checklist                                                 | PASS WITH RISK (RLS gap; everything else testable passed or is N/A pre-business-code)   |
| Docker builds (all 6 images)                                       | **PASS** (after fixing critical breakage)                                               |
| Docker Compose (dev/prod/observability)                            | PASS                                                                                    |
| Kubernetes manifests                                               | PASS (rendered only; never applied)                                                     |
| Web E2E smoke                                                      | PASS                                                                                    |
| Accessibility / visual regression                                  | NOT TESTED (no tooling configured)                                                      |
| Mobile                                                             | PASS (placeholder-level only)                                                           |

---

## 14. Risks

1. **RLS provides no real protection today** (superuser bypass). Until a
   dedicated non-superuser application role exists, tenant isolation
   relies entirely on correct application code always filtering by
   `tenant_id` — currently true, but with zero database-level backstop.
2. Docker image production stages now copy full `node_modules` +
   source trees (not a pruned/production-only install), inflating image
   size. Functional but not optimized; revisit with `pnpm deploy`.
3. No load-testing pipeline exists; performance budgets in
   `docs/performance/*.md` remain unverified aspirational targets.
4. Realtime dedupe/rate-limiting are per-process (not shared via Redis),
   a known limitation for multi-replica edge cases under retry storms.
5. CI security scanning steps (Semgrep/Trivy/Syft/gitleaks) were reviewed
   by inspection but not executed in this sandbox — first real PR/push
   will be the first live execution.

## 15. Technical Debts (carried + new)

- Argon2id placeholder (native dependency not installed).
- Mobile test harness is placeholder-level.
- No dedicated least-privilege Postgres application role (this audit's
  finding #2).
- Docker production images are not size-optimized (this audit's fix
  trade-off).
- Tailwind v4 / lightningcss build warnings (cosmetic, non-blocking).
- `packages/eslint-config`, and by extension any package without its own
  `lint` script, is not covered by `pnpm -r lint` unless explicitly added
  (as was done for `database` in Fase 4B) — worth a periodic audit.

---

## 16. Reproduction Commands

```bash
# Quality gate
pnpm install --frozen-lockfile
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build

# API integration tests (requires Docker)
pnpm --filter @saas/api test:integration

# Web E2E (requires Docker not required, but a built app)
pnpm --filter @saas/web build
pnpm --filter @saas/web test:e2e

# Container builds (requires Docker)
docker build -f infra/docker/Dockerfile.api -t saas/api:local .
docker build -f infra/docker/Dockerfile.realtime -t saas/realtime:local .
docker build -f infra/docker/Dockerfile.worker -t saas/worker:local .
docker build -f infra/docker/Dockerfile.scheduler -t saas/scheduler:local .
docker build -f infra/docker/Dockerfile.web -t saas/web:local .
docker build -f infra/docker/Dockerfile.migrate -t saas/migrate:local .

# Kubernetes manifest validation (no cluster required)
kubectl kustomize infra/kubernetes/base

# Compose validation (requires env vars per .env.example)
docker compose -f infra/docker/docker-compose.dev.yml config -q
docker compose -f infra/docker/docker-compose.prod.yml config -q
```

---

## 17. Decisions Requiring Your Approval

1. **Dedicated non-superuser PostgreSQL application role** to make RLS a
   real security boundary (separate from the migration-runner role).
   Requires a new ADR, new connection string/secret, and updates to
   `docker-compose.*.yml` / `infra/kubernetes/base` / migration scripts
   (`GRANT`s). **Not implemented in this audit** — architecture change,
   needs your sign-off.
2. Whether to optimize production Docker images (smaller, pruned
   `node_modules` via `pnpm deploy` or multi-stage pruning) now or defer —
   currently functional but larger than necessary.
3. Whether to invest in a load-testing pipeline before or after the first
   business module (no load-testable surface exists yet).

---

## 18. Indexing Status

**INDEXAÇÃO DEVIN: PENDENTE DE AÇÃO DO USUÁRIO**

This repository's indexing status in Devin/DeepWiki cannot be confirmed or
triggered from this session. Once the repository is on GitHub or GitLab:

1. Connect the repository to Devin.
2. Open **Settings**.
3. Open **Repositories**.
4. Select **Index repo**.
5. Choose the main branch (`master`).
6. Choose any relevant development branches.
7. Wait for indexing to complete.
8. Open **DeepWiki**.
9. Run validation questions in **Ask Devin**.

Suggested validation questions once indexed:

- Qual é a arquitetura do projeto?
- Como o tenant isolation é garantido?
- Onde estão as regras de autorização?
- Como funciona o fluxo Socket.IO?
- Como migrations são executadas?
- Como um novo módulo deve ser criado?
- Quais são os quality gates?
- Quais riscos permanecem abertos?

Compare the answers against this report and `docs/project-state.md`;
flag any drift.

---

## Post-Acceptance Addendum — 2026-08-24

The user formally approved the foundation and authorized remediation of the
critical RLS/application-role finding before the first business module.
ADR-014 now defines separated PostgreSQL runtime, migration, and provisioning
roles.

Repository/local status: **PASS WITH DEPLOYMENT RISK**.

- Real PostgreSQL 18 tests proved `blupo_app` is non-superuser,
  `NOBYPASSRLS`, non-owner, and blocked from cross-tenant reads and mutations.
- Tenant migrations passed up/down/up using `blupo_migrator`.
- Runtime grants exclude Kysely migration metadata.
- The migrate container image built and executed the full migration set.
- The API integration suite passed 12/12 tests across nine files; tenant provisioning worker integration passed 1/1.

Production role provisioning and secret rotation were not performed and remain
**NOT TESTED** / release-blocking operator work. The original audit evidence
above remains unchanged as historical evidence of the pre-remediation state.
