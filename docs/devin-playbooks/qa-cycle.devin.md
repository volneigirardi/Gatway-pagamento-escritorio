# QA Cycle Playbook

> Reusable playbook for running a QA Gatekeeper cycle on the Integre repository.
> Invoke with `@skills:qa-gatekeeper <scope> [base-sha] [head-sha]`.

## Outcome

A validated, evidence-based QA decision for a change or release candidate, recorded in `docs/factory/qa/00-stage-state.yaml`.

## Procedure

1. **Setup**
   - Read `AGENTS.md`, `docs/project-state.md`, `docs/factory/qa/00-stage-state.yaml`, and `docs/factory/agents/qa/LAST-HANDOFF.md`.
   - Run `git status --short` and `git log --oneline -5`.
   - Ensure Node.js 24, pnpm 11, and Docker are available.
   - Run `pnpm install --frozen-lockfile` if the lockfile changed.

2. **Preflight**
   - Run `pnpm --filter @saas/qa-agent preflight`.
   - Confirm the environment can execute the planned commands.

3. **Impact Analysis**
   - Read the diff: `git diff --name-only <base-sha>..<head-sha>`.
   - Map changed files to modules using `docs/factory/qa/01-system-map.md`.
   - Select tests based on scope and risk.

4. **Test Execution**
   - Run the selected commands from `docs/factory/qa/03-test-command-catalog.md`.
   - Capture command, exit code, duration, and output.
   - Save results in the structured QA state.

5. **Evidence Collection**
   - Link to Playwright reports, SBOMs, scan results, or CI artifacts.
   - Redact secrets.

6. **Defect Handling**
   - If a gate fails, create a structured defect report.
   - Stop the cycle and mark it `BLOQUEADA`.
   - Hand off to the development agent.

7. **Retest**
   - After the development agent delivers a fix, re-run the failing gate.
   - Update the defect record.

8. **Release Gate**
   - For `release` scope, check every item in `docs/factory/qa/QA_RELEASE_POLICY.md`.
   - Produce a committed attestation linked to the exact commit SHA and artifact digest.

9. **Handoff**
   - Update `docs/factory/qa/00-stage-state.yaml` and `docs/factory/agents/qa/LAST-HANDOFF.md`.
   - Report the final state.

## Specifications

| Scope      | Lint | Typecheck | Unit | Integration | E2E | Security Scans | Build | Release Attestation |
| ---------- | ---- | --------- | ---- | ----------- | --- | -------------- | ----- | ------------------- |
| `smoke`    | ✅   | ✅        | ✅   | —           | —   | —              | ✅    | —                   |
| `targeted` | ✅   | ✅        | ✅   | impacted    | —   | —              | ✅    | —                   |
| `expanded` | ✅   | ✅        | ✅   | impacted    | ✅  | —              | ✅    | —                   |
| `full`     | ✅   | ✅        | ✅   | ✅          | ✅  | ✅             | ✅    | —                   |
| `release`  | ✅   | ✅        | ✅   | ✅          | ✅  | ✅             | ✅    | ✅                  |

## Advice

- Always prefer deterministic tools over LLM reasoning to save tokens.
- Use Computer Use only for exploration; use Playwright for reproducible tests.
- Ask for video evidence only for critical journeys or important reproductions.
- If Docker is unavailable, mark integration/E2E as `INCONCLUSIVA`, not `PASS`.
- Run tenant isolation tests with two synthetic tenants for every change touching tenant boundaries.

## Forbidden Actions

- Merge, deploy, push, or access production.
- Install dependencies without approval.
- Disable or weaken tests, lint, type checks, or security controls.
- Hide failures or declare PASS without evidence.
- Fix product defects without explicit delegation.
- Chain phases without user authorization.

## Required from User

- Scope (`smoke|targeted|expanded|full|release`).
- Base and head SHAs (optional; defaults to current diff).
- Approval for destructive operations, dependency installation, or production smoke tests.

## Result Criteria

- `PASS`: command executed with exit code 0 and verifiable output.
- `FAIL`: command executed and returned non-zero or assertion failure.
- `BLOCKED`: gate cannot proceed due to defect, missing evidence, unresolved dependency, or unacceptable risk.
- `INCONCLUSIVE`: command could not be executed or result is unreliable (tool unavailable, flakiness not explained, incomplete environment).

## After a Checkpoint

When returning to this playbook after a pause:

1. Re-read `docs/factory/qa/handoffs/PART-XX-HANDOFF.md` and `docs/factory/agents/qa/LAST-HANDOFF.md`.
2. Re-run `git status --short`.
3. Re-run preflight.
4. Resume from the last completed step; do not skip.

## Do Not Chain Phases

Finish this cycle and report the final state. Do not start Part 3 or any subsequent implementation without an explicit user message.
