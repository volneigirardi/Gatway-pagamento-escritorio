# Database Directory Rules

- This directory contains migrations, seeds, and scripts.
- Migrations apply to the admin catalog and to tenant databases separately.
- Tenant migrations are idempotent and reproducible across new tenant provisioning.
- Scripts must never run destructive commands against production without explicit approval.
- Document every migration with up/down and rollback notes.
- Every change in this directory requires the appropriate database skill and a final `postgres-dba` subagent review before completion, commit, or merge.
- Critical/high DBA findings block completion; review evidence and the final verdict must be reported.
