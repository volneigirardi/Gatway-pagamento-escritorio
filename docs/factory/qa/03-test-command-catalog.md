# Test Command Catalog — QA Agent

> Commands that the QA agent can run to validate the Integre system.
> All commands are documented and safe; destructive commands require explicit approval.

## Legend

| Symbol | Meaning                                                          |
| ------ | ---------------------------------------------------------------- |
| ✅     | Safe to run in local development / QA environment                |
| ⚠️     | Requires services (Docker/Postgres/Redis) or generates artifacts |
| ❌     | Destructive, requires explicit approval                          |

## 1. Installation / Environment

| Command                          | Safety | Purpose                                               | When to Run                               |
| -------------------------------- | ------ | ----------------------------------------------------- | ----------------------------------------- |
| `pnpm install --frozen-lockfile` | ✅     | Install dependencies with exact lockfile              | After fresh clone or dependency change    |
| `pnpm docker:up`                 | ⚠️     | Start local Postgres, Redis, MinIO via Docker Compose | Before integration/E2E/manual exploration |
| `pnpm docker:down`               | ⚠️     | Stop local Docker services                            | After session                             |
| `pnpm docker:logs`               | ✅     | Tail Compose logs                                     | During debugging                          |

## 2. Static Quality Gates

| Command             | Safety | Purpose                                | Expected Result                                             |
| ------------------- | ------ | -------------------------------------- | ----------------------------------------------------------- |
| `pnpm format:check` | ✅     | Prettier formatting check              | Exit 0 (currently fails on `.devin/scripts/auto-commit.js`) |
| `pnpm lint`         | ✅     | ESLint across all workspace projects   | Exit 0                                                      |
| `pnpm typecheck`    | ✅     | TypeScript `--noEmit` across workspace | Exit 0                                                      |
| `pnpm build`        | ⚠️     | Build all deployables and packages     | Exit 0; web chunk-size warning expected                     |

## 3. Unit / Component Tests

| Command                                | Safety | Purpose                      | Notes                              |
| -------------------------------------- | ------ | ---------------------------- | ---------------------------------- |
| `pnpm test`                            | ✅     | Run all unit/component tests | 15 projects; exit 0                |
| `pnpm --filter @saas/auth test`        | ✅     | Auth package tests           | Password, TOTP, JWT, secrets       |
| `pnpm --filter @saas/http-client test` | ✅     | HTTP client tests            | SSRF guard, retry, circuit breaker |
| `pnpm --filter @saas/webhooks test`    | ✅     | Webhook utility tests        | Signature, delivery dead-letter    |
| `pnpm --filter @saas/web test`         | ✅     | Web unit tests               | React tree + http helper           |
| `pnpm --filter @saas/api test`         | ✅     | API unit tests               | Guards, health, safe-integer       |
| `pnpm --filter @saas/realtime test`    | ✅     | Realtime unit tests          | Gateway handshake                  |

## 4. Integration Tests

| Command                                       | Safety | Purpose                         | Requirements                               |
| --------------------------------------------- | ------ | ------------------------------- | ------------------------------------------ |
| `pnpm --filter @saas/api test:integration`    | ⚠️     | API integration suite           | Docker; testcontainers spin Postgres/Redis |
| `pnpm --filter @saas/worker test:integration` | ⚠️     | Worker provisioning integration | Docker                                     |

Specific suites:

| File                                                       | Scope                                          |
| ---------------------------------------------------------- | ---------------------------------------------- |
| `apps/api/test/auth.integration.spec.ts`                   | Login, MFA, refresh rotation, reuse revocation |
| `apps/api/test/tenant-isolation.integration.spec.ts`       | Cross-tenant negative tests                    |
| `apps/api/test/tenant-authorization.integration.spec.ts`   | Realm/RBAC negative tests                      |
| `apps/api/test/idempotency.integration.spec.ts`            | Idempotency keys + outbox                      |
| `apps/api/test/concurrency.integration.spec.ts`            | Concurrent transactions                        |
| `apps/api/test/database-roles.integration.spec.ts`         | Non-superuser RLS verification                 |
| `apps/api/test/migrations.integration.spec.ts`             | Tenant migration up/down/up                    |
| `apps/api/test/platform-control-plane.integration.spec.ts` | Plan/tenant creation idempotency               |
| `apps/api/test/admin-migrations.integration.spec.ts`       | Admin migration up/down/rollback guards        |
| `apps/worker/test/tenant-provisioning.integration.spec.ts` | End-to-end tenant DB provisioning              |

## 5. E2E / Browser Tests

| Command                                                                               | Safety | Purpose                  | Requirements                                    |
| ------------------------------------------------------------------------------------- | ------ | ------------------------ | ----------------------------------------------- |
| `pnpm --filter @saas/web test:e2e`                                                    | ⚠️     | Playwright smoke suite   | Browsers installed; builds and previews web app |
| `pnpm --filter @saas/web exec playwright install --with-deps chromium firefox webkit` | ⚠️     | Install browser binaries | One-time or CI                                  |
| `pnpm --filter @saas/web exec playwright test --project=chromium --ui`                | ⚠️     | Interactive debugging    | Local dev only                                  |

## 6. Database Operations

| Command                                                       | Safety | Purpose                                                   |
| ------------------------------------------------------------- | ------ | --------------------------------------------------------- |
| `pnpm db:migrate:status`                                      | ✅     | Show migration status                                     |
| `pnpm db:migrate`                                             | ❌     | Apply admin migrations; requires `MIGRATION_DATABASE_URL` |
| `pnpm db:migrate:down`                                        | ❌     | Rollback last admin migration                             |
| `pnpm --filter @saas/database-migrations migrate tenant`      | ❌     | Apply tenant migrations                                   |
| `pnpm --filter @saas/database-migrations migrate:down tenant` | ❌     | Rollback tenant migration                                 |
| `pnpm --filter @saas/database-migrations migrate:plan`        | ✅     | Dry-run pending migrations                                |
| `pnpm db:seed`                                                | ❌     | Seed synthetic data                                       |
| `pnpm db:reset`                                               | ❌     | Reset database                                            |

> **Rule:** migrations must never run against production without explicit approval and backup.

## 7. Security / Compliance Scans

| Command                                                      | Safety | Purpose                        | Notes                                                                     |
| ------------------------------------------------------------ | ------ | ------------------------------ | ------------------------------------------------------------------------- |
| `pnpm audit --audit-level moderate`                          | ✅     | Dependency vulnerability audit | CI runs this; currently two high advisories via Expo/Metro (`image-size`) |
| `gitleaks detect --source .` (if installed)                  | ✅     | Secret scan                    | CI uses `gitleaks/gitleaks-action`                                        |
| `pnpm dlx license-checker-rseidelsohn@4.4.2 --onlyAllow ...` | ✅     | License compliance             | CI command; see `.github/workflows/ci.yml`                                |

## 8. Containers and Infrastructure

| Command                                                           | Safety | Purpose                   | Notes              |
| ----------------------------------------------------------------- | ------ | ------------------------- | ------------------ |
| `docker build -f infra/docker/Dockerfile.api -t saas/api:local .` | ⚠️     | Build API image           | Local only         |
| `docker build -f infra/docker/Dockerfile.web -t saas/web:local .` | ⚠️     | Build web image           | Local only         |
| `kubectl kustomize infra/kubernetes/base`                         | ✅     | Validate K8s manifests    | Requires `kubectl` |
| `docker compose -f infra/docker/docker-compose.dev.yml config -q` | ✅     | Validate dev Compose file | No deploy          |

## 9. Performance / Load (Planned)

| Command                                   | Status        | Purpose                |
| ----------------------------------------- | ------------- | ---------------------- |
| `k6 run tests/performance/...`            | Not installed | Load test API          |
| `lighthouse-ci` / `playwright lighthouse` | Not installed | Web performance budget |
| `artillery quick --count ...`             | Not installed | Endpoint load spike    |

## 10. Accessibility (Planned)

| Command                                                                       | Status         | Purpose                 |
| ----------------------------------------------------------------------------- | -------------- | ----------------------- |
| `pnpm --filter @saas/web exec playwright test --project=chromium --grep a11y` | Not configured | axe-core powered checks |

## 11. Quality Gate Shortcut

| Command        | Safety                                             | Purpose                          |
| -------------- | -------------------------------------------------- | -------------------------------- |
| `pnpm quality` | ✅ (may spin services for integration if extended) | Runs `lint && typecheck && test` |

## 12. QA Agent Usage Notes

- Always run `pnpm install --frozen-lockfile` before validation if `pnpm-lock.yaml` changed.
- Always run `git status --short` before and after validation to detect unintended changes.
- Capture command output, exit code, and duration in `docs/factory/qa/00-stage-state.yaml`.
- Integration tests require Docker Desktop; if unavailable, mark status `BLOQUEADA` and record evidence.
- E2E tests require browser binaries; if not installed, run the install command once.
- Never run migration/seed/reset against production or shared environments without explicit approval.
