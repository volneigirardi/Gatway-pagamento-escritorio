# Database Schema Standards

## Identifiers

- Primary keys: `uuid` using `gen_random_uuid()`.
- Foreign keys: `uuid` referencing tenant tables or admin catalog.
- All business tables include `tenant_id uuid NOT NULL`.

## Required Columns

| Column     | Type        | Purpose          |
| ---------- | ----------- | ---------------- |
| id         | uuid        | Primary key      |
| tenant_id  | uuid        | Isolation        |
| created_at | timestamptz | Audit            |
| updated_at | timestamptz | Audit            |
| deleted_at | timestamptz | Soft delete      |
| created_by | uuid        | Audit (optional) |
| updated_by | uuid        | Audit (optional) |

## Constraints

- Foreign keys to `tenants(id)` where applicable.
- CHECK constraints for valid ranges and enums.
- Unique constraints scoped to `tenant_id` unless global.

## Row Level Security

- Enable RLS on tenant database tables unless explicitly exempted by ADR-017 (admin catalog).
- Admin catalog tenant tables use application-level `tenant_id` predicates and composite tenant-scoped FKs as the primary isolation mechanism; see ADR-017.
- Where RLS is enabled, policy: `tenant_isolation` allowing operations only when `tenant_id = current_setting('app.current_tenant')::uuid`.
- Bypass reserved to migration/superuser roles.

## Naming

- Tables: plural snake_case (`invoices`, `invoice_items`).
- Indexes: `idx_{table}_{columns}`.
- Constraints: `fk_{table}_{column}`, `chk_{table}_{rule}`, `uq_{table}_{columns}`.

## Soft Delete

- Add `deleted_at` to business tables.
- Indexes exclude deleted rows where appropriate.
- Purge routines documented in compliance runbook.
