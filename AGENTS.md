# Project Rules — SaaS Enterprise Foundation

## Identity and Purpose

This is the foundation of a long-lived enterprise SaaS product. It is multi-tenant, targets the regulated financial/fintech sector, and must remain secure, performant, auditable, and understandable by both AI agents and human developers.

## Approved Stack

- Node.js 24 LTS, TypeScript strict, pnpm 11
- pnpm workspaces + Nx
- NestJS with Fastify for backend deployables
- PostgreSQL 18 with Kysely + `pg`
- Redis for cache, sessions, rate limits, locks, queues, Socket.IO adapter
- BullMQ for jobs
- Socket.IO for realtime
- React 19 + Vite + TanStack Router/Query + Tailwind + Radix for web
- React Native + Expo (New Architecture, Hermes) for mobile
- OpenTelemetry + Pino + Prometheus/Grafana for observability
- Docker multi-stage, Docker Swarm and Kubernetes/Helm

## Multi-Tenancy Rule

- Tenant identity must come from trusted authentication context, never from unvalidated client input.
- Every business query must be filtered by `tenant_id`.
- Relationships must be verified within the tenant boundary.
- Authorization lives in the backend; frontend authorization is not sufficient.
- All tenant isolation changes require automated negative tests using two tenants.

## Security Rule

- No secrets in code, commits, or logs.
- Passwords hashed with Argon2id; sensitive data encrypted at rest with AES-256-GCM.
- TLS 1.3 in transit; mTLS for critical integrations.
- Validate all input with Zod in runtime and compile time.
- No `any` without documented justification.
- Run the `security-review` skill or `appsec-reviewer` subagent for security-sensitive changes.

## Evidence Rule

- Never claim a command ran, a test passed, a migration ran, or a scan succeeded without verifiable output.
- Never invent APIs, packages, configuration options, or results.
- Never hide failures or disable checks to make them pass.
- Distinguish fact, hypothesis, recommendation, pending decision, and tool limitation.

## No Silent Changes Rule

- Do not modify code unrelated to the current task.
- Do not change architecture or introduce a new pattern silently.
- Do not replace an existing equivalent pattern with a new one.
- Make the smallest coherent change.

## Planning Rule

- Non-trivial changes require a plan in `.devin/plans/` before implementation.
- Architecture, security, database, and dependency changes require documented reasoning (ADR or spec).
- Wait for explicit approval before destructive operations, production access, push, or deploy.

## ADR Rule

- Consult existing ADRs before contradicting them.
- A new decision that overrides an old one must be recorded in a new ADR.
- Never silently rewrite an accepted ADR.

## Documentation Rule

- Update `docs/project-state.md` when the project phase, active decisions, modules, integrations, or risks change.
- Do not turn documentation into a conversation diary.
- Keep `AGENTS.md` concise; put detailed guidance in skills, rules, and docs.

## Testing Rule

- Add tests for security-critical paths, especially tenant isolation.
- Run tests after changes. Do not claim success without evidence.
- Prefer failing tests first when fixing bugs.

## Completion Rule

- Before finishing: run `git diff`, review it, run relevant tests/skills, and summarize evidence.
- Do not mark a task complete until it is truly done.
- Report blockers, risks, and pending decisions explicitly.

## References

- Detailed rules: `.devin/rules/`
- Task skills: `.devin/skills/`
- Specialist subagents: `.devin/agents/`
- Project state: `docs/project-state.md`
- ADRs: `docs/adr/`
- Specs: `docs/specs/`
- Security: `SECURITY.md`
- Contributing: `CONTRIBUTING.md`
