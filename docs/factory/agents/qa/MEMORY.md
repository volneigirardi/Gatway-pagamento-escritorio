# QA Gatekeeper — Persistent Memory

> Stable facts, conventions, and authoritative references for the QA Gatekeeper.
> This file is updated only when roles, policies, stack, or canonical commands change.
> Do not use it to store transient test results or session output.

## Canonical References

| Document                                         | Purpose                                       |
| ------------------------------------------------ | --------------------------------------------- |
| `AGENTS.md`                                      | Project constitution and non-negotiable rules |
| `docs/project-state.md`                          | Current phase, decisions, modules, risks      |
| `docs/factory/qa/00-stage-state.yaml`            | Current QA stage, status, blockers            |
| `docs/factory/qa/01-system-map.md`               | System inventory and risk vectors             |
| `docs/factory/qa/02-current-quality-baseline.md` | Test catalog and current baseline             |
| `docs/factory/qa/03-test-command-catalog.md`     | Commands the QA agent can run                 |
| `docs/factory/qa/04-gap-and-dependency-plan.md`  | Future gaps and proposed dependencies         |
| `docs/factory/qa/05-risk-register.md`            | Risk register for QA and the system           |
| `docs/factory/agents/qa/AGENT_CONTRACT.md`       | Authority, limits, states, escalation         |
| `docs/factory/qa/QA_RELEASE_POLICY.md`           | Release gate and attestation rules            |
| `docs/factory/qa/QA_EVIDENCE_POLICY.md`          | Evidence collection and retention rules       |
| `.agents/skills/qa-gatekeeper/SKILL.md`          | Operational skill for the Devin agent         |
| `docs/devin-playbooks/qa-cycle.devin.md`         | Reusable QA cycle playbook                    |
| `docs/factory/qa/devin-blueprint.qa.yaml`        | Declarative environment blueprint             |
| `packages/qa-agent`                              | Executable QA core CLI/package                |

## Supported Scopes

- `smoke`: quick sanity check after a small change.
- `targeted`: tests selected by impact/risk of the diff.
- `expanded`: targeted + broader regression around changed modules.
- `full`: all gates (lint, typecheck, unit, integration, E2E, security scan, build).
- `release`: full gates + release attestation.

## Allowed Tools (from skill)

- `read`, `grep`, `glob`, `exec` for repository exploration and command execution.
- Browser/Playwright for E2E and Computer Use exploration.
- Subagents (`postgres-dba`, `appsec-reviewer`, `qa-reliability-reviewer`, etc.) for specialist review.

## Forbidden Actions

- Merge, deploy, push, production access, secret exposure, test weakening, silent product fixes.

## Environment Conventions

- Local validation runs against the working tree.
- Homologation uses Docker Compose (`pnpm docker:up`) with synthetic tenants.
- Production accepts only synthetic, non-destructive smoke tests from a dedicated QA account.

## Evidence Retention

- Command output, exit codes, and durations are recorded in `docs/factory/qa/00-stage-state.yaml`.
- Playwright traces and reports are kept under `apps/web/playwright-report/` (CI uploads as artifacts).
- SBOMs, scan results, and attestation artifacts are stored by CI, not in this repository.
