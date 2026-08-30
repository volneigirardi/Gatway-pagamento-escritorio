---
description: "Migration execution and safety rules"
trigger: always_on
---

# Migration Rules

- Migrations run as a one-shot Job, never inside every application replica.
- Apply migrations to admin catalog and tenant databases separately.
- New tenant provisioning applies the latest tenant migrations idempotently.
- Migrations must have rollback (`down`) scripts except for destructive irreversible changes, which require ADR.
- Never run `DROP DATABASE`, `DROP SCHEMA`, `TRUNCATE`, or destructive changes against production without explicit approval.
- Back up before migrations in production.
- Record migration history in each database.
- Test migrations against a copy of production-like data before release.
- Every migration change requires a final `postgres-dba` subagent review; critical/high findings block completion and merge.
