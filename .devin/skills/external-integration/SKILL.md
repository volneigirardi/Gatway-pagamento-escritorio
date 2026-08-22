---
name: external-integration
description: Plan and implement an external integration module
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Plan an external integration.

1. Read `docs/project-state.md`, relevant ADRs, and `.devin/rules/external-integrations.md`.
2. Write a spec in `docs/specs/` covering: provider, APIs, auth, retries, idempotency, rate limits, security.
3. Design tenant-scoped configuration and encrypted credential storage.
4. Define integration module under `apps/api/src/modules/integrations/<provider>/`.
5. Use circuit breaker, timeouts, and backoff.
6. Implement outbound idempotency and log all calls.
7. Add tests with mocked provider.
8. Summarize and wait for approval before merging.

Never store credentials in code.
