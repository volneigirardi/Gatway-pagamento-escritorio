# QA Gatekeeper — Learnings

> Lessons, proven patterns, and known pitfalls discovered while operating the QA Gatekeeper.
> Append-only; do not delete entries.

## 2026-08-30 — Part 1

- The project already has a strong quality foundation (lint, typecheck, unit, build, E2E smoke) but a pre-existing formatting failure in `.devin/scripts/auto-commit.js` breaks `pnpm format:check`.
- A pre-existing assertion bug in `apps/api/test/admin-migrations.integration.spec.ts` causes a false failure in the integration suite.
- Docker, Node.js 24, pnpm 11, and the test harness are functional in this environment.
- The web frontend uses TanStack Router configured manually in `apps/web/src/main.tsx` (not file-based codegen yet).

## 2026-08-30 — Part 2

- The QA core should be a package/CLI, not a long-running LLM service, to keep it deterministic and token-efficient.
- State transitions must be enforced by code, not just documentation, to prevent invalid gate states.
- All QA artifacts must live under `docs/factory/qa/`, `docs/factory/agents/qa/`, `.agents/skills/qa-gatekeeper/`, `docs/devin-playbooks/`, and `packages/qa-agent/` to avoid conflict with product code.
