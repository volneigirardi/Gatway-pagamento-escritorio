# Risk Register — QA Agent Baseline

> Pre-existing and emerging risks relevant to building and operating a dedicated QA agent for Integre.

## 1. Risk Summary

| ID  | Risk                                                                                | Severity | Likelihood | Owner                   | Status                           |
| --- | ----------------------------------------------------------------------------------- | -------- | ---------- | ----------------------- | -------------------------------- |
| R01 | QA agent duplicates or contradicts existing project memory                          | Medium   | Medium     | QA Agent / Architecture | Monitoring                       |
| R02 | QA agent silently fixes product defects instead of reporting                        | High     | Low        | QA Agent / Development  | Mitigated by rule                |
| R03 | QA tests run against production or real credentials                                 | Critical | Low        | QA Agent / Security     | Mitigated by policy              |
| R04 | Persistent QA memory introduces new database/schema maintenance                     | Medium   | Medium     | DBA / QA Agent          | Planned                          |
| R05 | Playwright tests become flaky due to timing/animations/network                      | Medium   | High       | QA Agent                | Monitoring                       |
| R06 | Integration tests require Docker; not available in all sessions                     | Medium   | Medium     | QA Agent / DevOps       | Documented                       |
| R07 | Mobile testing remains placeholder; regressions slip through                        | High     | Medium     | QA Agent                | Accepted for now                 |
| R08 | Performance/load/security harness not yet built                                     | High     | Medium     | QA Agent                | Planned                          |
| R09 | Tenant isolation coverage assumes non-superuser roles; production roles untested    | Critical | Medium     | DBA / Platform SRE      | Accepted with risk               |
| R10 | Formatting failure in `.devin/scripts/auto-commit.js` masks real issues in CI       | Medium   | Medium     | QA Agent                | Baseline                         |
| R11 | `admin-migrations.integration.spec.ts` assertion bug erodes trust in migration gate | Medium   | Medium     | QA Agent                | Baseline                         |
| R12 | AI token consumption explodes if QA uses LLM for every assertion                    | Medium   | High       | QA Agent                | Mitigated by deterministic tools |
| R13 | Homologação data leaks into production or vice-versa                                | Critical | Low        | QA Agent / Security     | Mitigated by isolation           |
| R14 | Atestação de QA forjada ou desvinculada do commit real                              | High     | Low        | QA Agent / Release      | Mitigated by SHA linkage         |

## 2. Detailed Risks

### R01 — Memory Duplication

- **Description:** The QA agent could create a parallel knowledge system that conflicts with `docs/project-state.md`, ADRs, `.devin/rules/`, and skills.
- **Mitigation:** QA extends existing memory; new artifacts live under `docs/factory/qa/`; cross-references to canonical docs are required.

### R02 — Silent Fixes

- **Description:** The agent might correct product code while validating instead of filing defects, eroding accountability.
- **Mitigation:** Hard rule: QA reports, blocks, and retests; does not modify app code unless explicitly approved in a defect-fix session.

### R03 — Production Access

- **Description:** Browser automation or API tests could target production URLs or use real secrets.
- **Mitigation:** Base URLs come from environment/Secrets; production smoke tests are synthetic and non-destructive; MASTER QA account never used in production.

### R04 — Schema Maintenance

- **Description:** Persistent memory requires PostgreSQL tables/indexes/vector extension, adding operational surface.
- **Mitigation:** Design minimal schema; reuse existing tenant model if possible; run `postgres-dba` gate; keep blobs in MinIO/S3.

### R05 — Flaky E2E

- **Description:** Playwright tests may fail intermittently due to animations, network, or uncontrolled state.
- **Mitigation:** Stable synthetic data, deterministic seeds, wait conditions, retries only for infra flakiness, trace/video on first retry.

### R06 — Docker Dependency

- **Description:** Integration tests rely on Docker; Windows/native dev or constrained CI may fail.
- **Mitigation:** Document fallback; CI runs Linux; local manual runs use `docker:up`; mark `BLOQUEADA` if Docker unavailable.

### R07 — Mobile Gap

- **Description:** Mobile has only placeholder tests; real user journeys are unverified.
- **Mitigation:** Explicitly accepted baseline; add Detox/Maestro before mobile distribution.

### R08 — Missing Performance/Security Harness

- **Description:** No k6, Lighthouse, or DAST; SLA/security claims are unverified.
- **Mitigation:** Build harness in Parts 6/8; run after feature changes; fail gate if missing.

### R09 — Production Role Uncertainty

- **Description:** RLS/role isolation is verified only against disposable containers; real production role provisioning is untested.
- **Mitigation:** External operator action required before production; re-run role/integration tests against staging mirror.

### R10 — Formatting Failure

- **Description:** `pnpm format:check` fails on a pre-existing file; could hide new formatting issues.
- **Mitigation:** List as baseline; fix in hygiene pass before Part 9.

### R11 — Migration Test Assertion Bug

- **Description:** A false failure in `admin-migrations.integration.spec.ts` undermines confidence in migration gates.
- **Mitigation:** Verify intent with development team; correct assertion; retest.

### R12 — Token Cost

- **Description:** Using LLM for every assertion is expensive and slow.
- **Mitigation:** Use deterministic tools (Playwright, Vitest, grep, SQL) for validation; reserve LLM for risk analysis and triage.

### R13 — Environment Leakage

- **Description:** Synthetic tenants or credentials could be confused with production data.
- **Description:** Use isolated homologação DB, distinct naming convention, clear `.env` separation, and Secrets scoping.

### R14 — Attestation Integrity

- **Description:** A QA attestation could be produced for the wrong commit or bypassed.
- **Mitigation:** Attestation includes exact source SHA, artifact digest, test evidence URLs; pipeline refuses deploy without valid attestation.

## 3. Risk Acceptance

- R07 (mobile gap) and R09 (production roles) are formally accepted for the foundation phase but must be resolved before production launch.
- R10 and R11 are accepted as Part 1 baseline defects and will be re-evaluated before Part 9 gate.

## 4. Open Decisions

1. Should QA memory be a separate PostgreSQL database or an additional schema in `saas-admin`?
2. Should homologação run inside Docker Compose locally and a dedicated cloud environment in CI?
3. Which performance/load tool should be adopted: `k6` (AGPL) or `autocannon` (MIT)?
4. Should visual regression use Playwright screenshots, Storybook test runner, or a third-party service?
