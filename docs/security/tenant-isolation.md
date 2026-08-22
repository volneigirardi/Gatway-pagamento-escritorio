# Tenant Isolation

## Model

Database-per-tenant with a central `saas-admin` catalog.

## Rules

1. `tenant_id` comes from trusted JWT claim `tid`, never from client input.
2. Every business query must filter by `tenant_id`.
3. Row Level Security (RLS) policies enforce tenant boundaries at the database level.
4. Relationships must be validated within the same tenant.
5. Admin operations are logged and scoped.

## Database-Level Isolation

- Each tenant has its own PostgreSQL database.
- Central catalog maps `tenant_id` -> connection string.
- RLS policies on tenant tables as defense-in-depth.
- Foreign keys enforce referential integrity within tenant.

## Application-Level Isolation

- Request context carries `tenant_id` via AsyncLocalStorage.
- Connection manager resolves tenant DB from context.
- Guards reject cross-tenant URLs/IDs.

## Realtime Isolation

- Socket.IO rooms named `tenant:{tenant_id}`.
- `tenant_id` extracted from authenticated handshake token.
- Client cannot request arbitrary room membership.

## Testing

- Automated negative tests with two real tenants.
- Direct SQL bypass attempt against RLS.
- Cross-tenant object access attempts.
