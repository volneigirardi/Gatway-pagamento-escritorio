# Database Directory Rules

- This directory contains migrations, seeds, and scripts.
- Migrations apply to the admin catalog and to tenant databases separately.
- Tenant migrations are idempotent and reproducible across new tenant provisioning.
- Scripts must never run destructive commands against production without explicit approval.
- Document every migration with up/down and rollback notes.
