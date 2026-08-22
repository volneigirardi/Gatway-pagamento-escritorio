---
name: incident-debug
description: Investigate and triage an incident or failure
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Investigate an incident systematically.

1. Identify symptoms: error messages, affected tenants/users, time window.
2. Collect logs and traces (structured logs, OpenTelemetry, metrics).
3. Check recent deployments, commits, and configuration changes.
4. Identify impacted components: API, workers, realtime, scheduler, database, Redis, integrations.
5. Formulate a timeline and hypothesis.
6. Do not apply production fixes without approval.
7. Produce a triage report with:
   - Impact
   - Likely root cause
   - Evidence
   - Proposed mitigation
   - Rollback options
   - Follow-up actions

Do not run destructive commands against production.
