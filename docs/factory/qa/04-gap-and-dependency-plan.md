# Gap and Dependency Plan — QA Agent

> Identifies what the QA agent needs to become a permanent, autonomous gate in the Integre project.
> Part 1 only lists and justifies; no installation occurs here.

## 1. Gaps Found in Part 1

| ID  | Gap                                            | Risk                                          | Current Mitigation                           | Target State                                                          |
| --- | ---------------------------------------------- | --------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| G01 | No dedicated QA agent skill/playbook/blueprint | QA knowledge scattered; inconsistent gates    | Existing `quality-gate` skill + project docs | `.agents/skills/qa/SKILL.md`, `qa-cycle.devin.md` playbook, blueprint |
| G02 | No persistent QA memory outside session        | Lost learnings, duplicated exploration        | `docs/project-state.md`, ADRs, rules         | `docs/factory/qa/` + PostgreSQL/Knowledge/Second Brain                |
| G03 | No homologation environment spec               | Tests may run against dev/prod inconsistently | Docker Compose dev; CI uses services         | Isolated homologação with synthetic tenants + Secrets                 |
| G04 | Limited E2E coverage                           | Critical journeys mocked in smoke tests       | 4-project Playwright smoke                   | Full Playwright journeys over real API/DB/queues                      |
| G05 | No mobile E2E harness                          | Mobile regressions undetected                 | Unit placeholder                             | Detox/Maestro harness                                                 |
| G06 | No accessibility automation                    | WCAG 2.2 AA not continuously verified         | Manual checks                                | axe-core / Playwright a11y suite                                      |
| G07 | No performance/load harness                    | SLA 99.9% target untested                     | None                                         | k6/Artillery/Lighthouse budgets                                       |
| G08 | No security regression suite beyond CI scans   | Tenant isolation/auth drift possible          | Semgrep/gitleaks in CI                       | Dedicated ZAP/OWASP, property-based tests                             |
| G09 | No visual regression                           | UI drift undetected                           | Storybook 8.6.17                             | Storybook test runner + Chromatic/screenshot diff                     |
| G10 | No defect triage/retest workflow               | QA findings may be lost                       | Informal                                     | Structured bug report + retest gate                                   |
| G11 | No production attestation artifact             | Cannot prove gate passed before deploy        | CI green check                               | Signed/committed attestation linked to commit SHA                     |

## 2. Dependency Plan

### Already Available (Reuse)

| Tool           | Version                        | Purpose                                        |
| -------------- | ------------------------------ | ---------------------------------------------- |
| Playwright     | `1.62.1`                       | Browser automation, E2E                        |
| testcontainers | `12.1.0`                       | Real Postgres/Redis in tests                   |
| Vitest         | `4.1.10`                       | Unit/integration runner                        |
| Zod            | `4.4.3`                        | Contract/property tests                        |
| MinIO (Docker) | `RELEASE.2026-01-29T03-56-32Z` | Object storage for evidence                    |
| PostgreSQL 18  | `18.4`                         | Persistent memory + vector extension candidate |
| Redis 7.4      | `7.4-alpine`                   | Cache, sessions, rate limits, queues           |

### Proposed New Dependencies / Extensions

| Dependency / Extension             | Proposed Version                   | Purpose                                                  | License               | Security Surface                                                                    | Alternative Without New Dep                                            |
| ---------------------------------- | ---------------------------------- | -------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `pgvector` PostgreSQL extension    | `0.8.0`                            | Vector storage for QA memory/RAG                         | PostgreSQL License    | Adds extension; requires `CREATE EXTENSION` and migrations; part of future DBA gate | Plain JSONB `ORDER BY embedding <->` approximations; lower quality     |
| `@axe-core/playwright`             | `4.10.1` (pinned after evaluation) | Automated accessibility checks inside Playwright         | MPL-2.0               | Runs only in test context; no runtime exposure                                      | Manual WCAG checklists; slower, error-prone                            |
| `k6` CLI                           | `0.54.0`                           | Load and performance testing                             | AGPL-3.0 / commercial | Only in CI/QA environments; no prod access                                          | `autocannon` (MIT, lighter); or custom Node scripts with less fidelity |
| `lighthouse` / `lighthouse-ci`     | `12.2.0` / `0.14.0`                | Web performance budget                                   | Apache-2.0            | Runs against local/qa URLs                                                          | Manual Lighthouse in browser; not automatable                          |
| `@playwright/test` already present | current                            | E2E and visual regression baseline                       | Apache-2.0            | Existing                                                                            | —                                                                      |
| `storybook/test-runner`            | `0.19.0`                           | Visual/interaction tests for design system               | MIT                   | Requires Storybook dev/build                                                        | Manual component checks                                                |
| `zod-to-json-schema` (if needed)   | `3.23.5`                           | Generate JSON Schema from Zod for fuzzing/property tests | MIT                   | Build-time only                                                                     | Manual schema mirroring                                                |
| `fast-check`                       | `3.22.0`                           | Property-based testing for critical paths                | MIT                   | Test context only                                                                   | Hand-written edge-case tables                                          |

### Optional / Future

| Dependency                                | Purpose                                   | Decision Deferred To                               |
| ----------------------------------------- | ----------------------------------------- | -------------------------------------------------- |
| LangChain / LlamaIndex-style orchestrator | RAG over QA memory                        | Part 3 — after schema is proven                    |
| Graph database (Neo4j, Age)               | Relationship map of modules/tests/defects | Part 3 — likely replaceable with relational schema |
| Detox / Maestro                           | Mobile E2E                                | Part 8 or after mobile harness                     |
| OWASP ZAP / Nuclei                        | Security scanning                         | Part 8                                             |

## 3. Installation Approval Requests

Part 1 does **not** install anything. The following approvals are anticipated for later parts:

1. **Approve `pgvector` extension** for PostgreSQL 18 to enable vector QA memory (Part 3).
   - Requires database schema migration and mandatory `postgres-dba` review.
2. **Approve `@axe-core/playwright`** for accessibility automation (Part 8).
   - MPL-2.0 license; test-only dependency.
3. **Approve `k6`** (or `autocannon`) for load/performance testing (Part 8).
   - AGPL-3.0 for k6 CLI; consider commercial implications. Alternative: `autocannon` MIT.
4. **Approve `lighthouse-ci`** for web performance budgets (Part 8).
   - Apache-2.0.

## 4. Architectural Decisions to Record

| Decision                                                                        | Rationale                                                         | ADR Needed  |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------- |
| QA agent is a separate concern, not embedded in app code                        | Keeps production artifacts free of QA-only logic                  | Yes         |
| QA memory lives primarily in repository + PostgreSQL                            | Matches project's existing database-per-tenant pattern; auditable | Yes         |
| QA uses Playwright for reproducible journeys; Computer Use only for exploration | Economizes tokens; deterministic evidence                         | Yes         |
| QA attestations are committed artifacts, not just CI checks                     | Provides provenance linked to exact commit SHA                    | Yes         |
| Homologação uses Docker Compose + synthetic tenants                             | Aligns with existing dev/CI infra; isolates tests                 | Spec needed |

## 5. Migration / Schema Impact Forecast

| Change                                                            | Migration                                     | DBA Gate                                   |
| ----------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| QA memory tables (facts, embeddings, evidence, defects, releases) | New tenant-agnostic schema or dedicated QA DB | Yes — Part 3                               |
| `pgvector` extension                                              | `CREATE EXTENSION vector;` + vector column    | Yes — Part 3                               |
| Evidence storage metadata                                         | Metadata table; blobs in MinIO/S3             | Optional local table; no DBA if MinIO only |

## 6. No-Install Commitment for Part 1

No new dependency, package, container image, or schema change is introduced in Part 1. This document is planning-only.
