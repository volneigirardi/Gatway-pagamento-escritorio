# Current Quality Baseline — QA Agent

> Captured 2026-08-30 from source SHA `7a12564260bf9508f77b615fd74e6a2bcc8455d5`.

## 1. Executive Summary

The foundation is substantially sound: lint, typecheck, unit tests, build, and E2E smoke tests all pass. The two active quality gaps are a Prettier formatting failure in `.devin/scripts/auto-commit.js` and an integration test assertion bug in `admin-migrations.integration.spec.ts`. Both are pre-existing baseline issues; they are recorded here and will be resolved or formally accepted before the QA gate is declared complete.

## 2. Command Results

| Gate            | Command                                    | Exit Code | Duration | Result   | Notes                                       |
| --------------- | ------------------------------------------ | --------- | -------- | -------- | ------------------------------------------- |
| Format check    | `pnpm format:check`                        | 1         | ~3 s     | **FAIL** | `.devin/scripts/auto-commit.js` style issue |
| Lint            | `pnpm lint`                                | 0         | ~71 s    | PASS     | Mobile parser warning is known/harmless     |
| Typecheck       | `pnpm typecheck`                           | 0         | ~26 s    | PASS     | 20 projects                                 |
| Unit tests      | `pnpm test`                                | 0         | ~16 s    | PASS     | 15 projects, 27 tasks                       |
| Build           | `pnpm build`                               | 0         | ~14 s    | PASS     | 18 projects; web chunk-size warning         |
| API integration | `pnpm --filter @saas/api test:integration` | 1         | ~137 s   | **FAIL** | 1/14 tests failed (assertion bug)           |
| E2E smoke       | `pnpm --filter @saas/web test:e2e`         | 0         | ~17 s    | PASS     | 20/20 across 4 projects                     |

## 3. Test Inventory

### Unit / Component Tests

| Location                              | Count    | Notes                                      |
| ------------------------------------- | -------- | ------------------------------------------ |
| `packages/auth/**/*.test.ts`          | 17 tests | password, TOTP, JWT, secrets, index        |
| `packages/http-client/**/*.test.ts`   | 26 tests | SSRF guard, client retries/circuit breaker |
| `packages/webhooks/**/*.test.ts`      | 18 tests | signature, delivery dead-letter            |
| `packages/contracts/**/*.test.ts`     | 8 tests  | platform, tenant-portal, billing           |
| `packages/config/**/*.test.ts`        | 6 tests  | env hydration                              |
| `packages/database/**/*.test.ts`      | 1 test   | schema helpers                             |
| `packages/observability/**/*.test.ts` | 4 tests  | telemetry                                  |
| `packages/testing/**/*.test.ts`       | 6 tests  | test helpers                               |
| `packages/outbox/**/*.test.ts`        | 2 tests  | outbox pattern                             |
| `apps/api/src/**/*.spec.ts`           | 6 tests  | safe-integer, auth guard, health           |
| `apps/realtime/src/**/*.spec.ts`      | 6 tests  | events gateway                             |
| `apps/scheduler/src/**/*.spec.ts`     | 2 tests  | example scheduler                          |
| `apps/worker/src/**/*.spec.ts`        | 1 test   | example worker                             |
| `apps/web/src/**/*.test.ts(x)`        | 5 tests  | main, http client                          |
| `apps/mobile/src/**/*.test.ts(x)`     | 1 test   | app placeholder                            |

### Integration Tests (`apps/api/test/*.integration.spec.ts`)

| File                                         | Result   | Notes                                                     |
| -------------------------------------------- | -------- | --------------------------------------------------------- |
| `auth.integration.spec.ts`                   | PASS     | password rotation, MFA, refresh rotation/reuse revocation |
| `tenant-isolation.integration.spec.ts`       | PASS     | cross-tenant read/mutation blocked                        |
| `tenant-authorization.integration.spec.ts`   | PASS     | realm/rbac negative tests                                 |
| `idempotency.integration.spec.ts`            | PASS     | idempotency keys + outbox                                 |
| `concurrency.integration.spec.ts`            | PASS     | concurrent transactions                                   |
| `database-roles.integration.spec.ts`         | PASS     | non-superuser RLS verification                            |
| `migrations.integration.spec.ts`             | PASS     | tenant migration up/down/up                               |
| `platform-control-plane.integration.spec.ts` | PASS     | plan/tenant creation, realm rejection                     |
| `admin-migrations.integration.spec.ts`       | **FAIL** | one assertion expects 6 migrations, gets 5                |

### E2E Tests (`apps/web/e2e/smoke.spec.ts`)

| Test                                             | Projects                                 | Result |
| ------------------------------------------------ | ---------------------------------------- | ------ |
| redirects anonymous users to login               | Chromium, Firefox, WebKit, mobile-Chrome | PASS   |
| authenticates platform owner and loads dashboard | Chromium, Firefox, WebKit, mobile-Chrome | PASS   |
| routes tenant administrator to company portal    | Chromium, Firefox, WebKit, mobile-Chrome | PASS   |
| keyboard bypass and mobile navigation            | Chromium, Firefox, WebKit, mobile-Chrome | PASS   |
| no console errors on login                       | Chromium, Firefox, WebKit, mobile-Chrome | PASS   |

## 4. Coverage Observations

- Tenant isolation is well covered with real two-tenant negative tests.
- Auth lifecycle (login, MFA, refresh rotation, reuse revocation) is covered.
- Provisioning worker integration test covers end-to-end tenant DB creation.
- Realtime has unit tests but lacks cross-node integration coverage in CI.
- Mobile has only a placeholder test; full E2E harness missing.
- Accessibility tests exist only as smoke-level assertions; no axe-core or automated WCAG coverage.
- Performance/load tests are documented but no harness is wired.
- Visual regression not present.
- Security scanning is in CI (gitleaks, Semgrep, Trivy, license check) but not run locally as part of `pnpm quality`.

## 5. Pre-existing Defects (Baseline)

| ID  | Severity | Location                                                 | Description                                                               | Evidence                   |
| --- | -------- | -------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------- |
| Q01 | medium   | `.devin/scripts/auto-commit.js`                          | Prettier formatting failure breaks `pnpm format:check`                    | `pnpm format:check` exit 1 |
| Q02 | medium   | `apps/api/test/admin-migrations.integration.spec.ts:458` | Test expects `restored.results` length 6, receives 5                      | Integration run output     |
| Q03 | low      | `apps/web` build                                         | Chunk-size warning for `index-DDomPJxt.js` (~177 kB gzipped, > threshold) | Build output               |
| Q04 | low      | `apps/mobile`                                            | Native deps fail on Windows without Python; placeholder test only         | `package.json`, CI notes   |

## 6. Tooling Versions

| Tool           | Version  |
| -------------- | -------- |
| Vitest         | `4.1.10` |
| Playwright     | `1.62.1` |
| testcontainers | `12.1.0` |
| TypeScript     | `5.9.3`  |
| ESLint         | `10.8.1` |
| Prettier       | `3.9.6`  |
| Nx             | `23.1.1` |

## 7. Recommendations for QA Agent

1. Treat Q01 and Q02 as the first retest targets in Part 7.
2. Add Playwright journeys for the full tenant provisioning flow (currently mocked in smoke tests).
3. Add accessibility scanning (`@axe-core/playwright`) on every new web route.
4. Add performance budget assertions for build artifacts.
5. Extend integration suite to cover realtime two-node delivery, backup/restore round-trip, and worker dead-letter scenarios.
