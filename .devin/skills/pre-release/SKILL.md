---
name: pre-release
description: Checklist before a release or deploy
triggers:
  - user
allowed-tools:
  - read
  - exec
---

Run the pre-release checklist.

1. Verify all tests pass (use `quality-gate` skill).
2. Confirm version bump and changelog are correct.
3. Verify migrations are up to date and tested.
4. Verify Docker images build for all deployables.
5. Confirm secrets and configs are in place for target environment.
6. Check deployment runbook for rollback steps.
7. Verify no destructive operations are included without approval.
8. Confirm monitoring/alerting is active.
9. Summarize readiness.

Do not deploy without explicit approval.
