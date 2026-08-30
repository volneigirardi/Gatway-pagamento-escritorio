# Authorization Strategy

## Source of Truth

The backend is the only source of truth. Frontend roles are hints for UI, not enforcement.

## Models

### RBAC

- Roles stored per tenant.
- Permissions are granular actions (`invoices:read`, `invoices:write`).
- Users have roles; roles aggregate permissions.

### ABAC

- Used only when static role is insufficient (e.g., invoice owner, same-team member).
- Rules must be documented and reviewed.

## Enforcement Layers

1. **Global guard** rejects unauthenticated requests.
2. **Tenant scope** ensures `tenant_id` comes from JWT and matches resource.
3. **Permission guard** checks required permission.
4. **Object-level** verifies ownership/relationship within tenant.
5. **Field-level** redacts or omits forbidden fields.

## Tenant Context

- `tenant_id` is extracted from access token claim `tid`.
- It is stored in `RequestContext` (AsyncLocalStorage).
- Every data query must include `tenant_id` predicate or be protected by RLS.

## Authorization Realms

- Platform tokens use `realm=platform`, audience `blupo-platform`, and no `tid`.
- Tenant tokens use `realm=tenant`, audience `blupo-tenant`, and a signed `tid`.
- `/api/v1/platform/*` rejects tenant tokens before controller/business logic.
- `/api/v1/tenant/*` rejects platform tokens unless a future, explicitly designed support flow supersedes ADR-015.

## Admin

- Global admin role exists only in admin catalog.
- Global admin actions are separately audited with explicit marker.
- Global admin cannot bypass tenant isolation when accessing tenant data.

## Testing

- Negative test: tenant A user cannot read tenant B data.
- Negative test: user without permission gets 403.
- Negative test: tampered JWT claim rejected.
