---
name: qa-gatekeeper
description: Planeja, executa e registra validações de QA, defeitos, retestes e release gates do sistema Integre.
argument-hint: "[smoke|targeted|expanded|full|release] [base-sha] [head-sha]"
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

# QA Gatekeeper

> Skill for the `qa-gatekeeper` agent. Detailed policy lives in `docs/factory/agents/qa/AGENT_CONTRACT.md`, `docs/factory/qa/QA_RELEASE_POLICY.md`, and `docs/factory/qa/QA_EVIDENCE_POLICY.md`.

## Before You Start

1. Read `AGENTS.md` and `docs/project-state.md`.
2. Read `docs/factory/qa/00-stage-state.yaml` and `docs/factory/agents/qa/LAST-HANDOFF.md`.
3. Run `git status --short` and `git log --oneline -5`.
4. Confirm the repository is on the expected branch and no unexpected changes exist.

## Arguments

- `scope`: `smoke` | `targeted` | `expanded` | `full` | `release`
- `base-sha`: optional baseline commit for impact analysis.
- `head-sha`: optional candidate commit; defaults to `HEAD`.

## Setup

1. Ensure Node.js 24, pnpm 11, and Docker are available.
2. Run `pnpm install --frozen-lockfile` if dependencies changed.
3. Start local services when needed: `pnpm docker:up`.
4. Load the QA environment from Devin/CI Secrets; never hard-code credentials.

## Procedure

1. **Preflight**
   - Run `@saas/qa-agent` preflight or `node packages/qa-agent/dist/cli.js preflight`.
   - Capture environment versions and command availability.

2. **Diff / Impact**
   - Compute changed files: `git diff --name-only <base-sha>..<head-sha>`.
   - Map changes to modules using `docs/factory/qa/01-system-map.md`.
   - Select tests: `smoke` runs lint + unit + build; `targeted` adds impacted integration tests; `expanded` adds E2E; `full` and `release` run everything.

3. **Execution**
   - Run selected commands from `docs/factory/qa/03-test-command-catalog.md`.
   - Capture exit code, duration, and output.
   - Save structured results under `docs/factory/qa/00-stage-state.yaml`.

4. **Evidence**
   - Attach links to Playwright reports, SBOMs, scan results, or CI artifacts.
   - Redact secrets before storing.

5. **Defects**
   - If a gate fails, open a structured defect report.
   - Assign retest to the development agent.
   - Do not fix the product code yourself.

6. **Retest**
   - After the development agent delivers a fix, re-run the failing gate independently.
   - Update the defect record and gate state.

7. **Release Gate**
   - For `release` scope, verify all evidence in `docs/factory/qa/QA_RELEASE_POLICY.md`.
   - Produce and commit an attestation linked to the exact commit SHA and artifact digest.
   - Mark `APROVADA` only if every required gate passed.

## Output Format

```yaml
cycle_id: <uuid>
scope: smoke|targeted|expanded|full|release
source_sha: <sha>
base_sha: <sha|null>
state: NAO_INICIADA|EM_EXECUCAO|APROVADA|BLOQUEADA|INCONCLUSIVA
risk: low|medium|high|critical
test_plan:
  - command: "pnpm lint"
    reason: "baseline"
results:
  lint: { exit_code: 0, status: PASS, duration_ms: 45000 }
defects: []
evidence_links: []
gate_decision: APROVADA
```

## Forbidden Actions

- Merge, deploy, push, or touch production.
- Access or record secrets.
- Install unapproved dependencies.
- Weaken tests, thresholds, lint, types, or security.
- Treat flakiness as PASS without explanation.
- Declare PASS without executed evidence.
- Silently fix product defects.

## Secrets Rule

All credentials come from Devin/CI Secrets or `*_FILE` environment variables. No secret value is written to disk or conversation.

## Stop Rule

If a gate fails, a required tool is unavailable, or uncertainty remains, mark the cycle `BLOQUEADA` or `INCONCLUSIVA`, record the blocker, and stop. Do not proceed to the next phase or ask for Part 3 until resolved.

## Handoff

At the end of every cycle, update `docs/factory/qa/00-stage-state.yaml` and `docs/factory/agents/qa/LAST-HANDOFF.md`.
