# Threat Model

## Scope

This threat model covers the multi-tenant enterprise SaaS foundation: API, workers, scheduler, realtime, web, mobile, database, Redis, object storage, CI/CD, and deployment infrastructure.

## Trust Boundaries

- Internet / untrusted client
- Load balancer / edge (TLS termination, WAF, rate limits)
- Container runtime (Docker Swarm / Kubernetes)
- Internal services (API, worker, scheduler, realtime)
- Data stores (PostgreSQL, Redis, MinIO/S3)
- External integrations and webhooks

## Assets

- Tenant data and configurations
- User credentials and sessions
- JWT signing keys
- Database credentials
- Redis data (sessions, rate limits, queues, Socket.IO adapter)
- Audit logs
- Backups

## Threat Actors

| Actor                   | Motivation                 | Capabilities                     |
| ----------------------- | -------------------------- | -------------------------------- |
| Anonymous attacker      | Disruption, data theft     | Network access, public API       |
| Tenant user             | Access other tenants' data | Valid credentials for one tenant |
| Insider (developer/ops) | Privilege abuse            | Internal network, credentials    |
| Malicious integration   | Supply-chain attack        | Valid-ish webhook/API requests   |
| Automated scanner       | Mass exploitation          | Public endpoints                 |

## STRIDE Analysis

### Spoofing

- **Threat:** Attacker impersonates a user or tenant admin.
- **Mitigation:** JWT access tokens signed with RS256, short expiry, refresh rotation, MFA, tenantId extracted from trusted token.

### Tampering

- **Threat:** Request/response or queue message tampering.
- **Mitigation:** TLS 1.3, signed webhooks, idempotency keys, input validation with Zod, audit logs.

### Repudiation

- **Threat:** User denies performing an action.
- **Mitigation:** Immutable audit logs with tenant_id, actor_id, correlation_id, timestamps.

### Information Disclosure

- **Threat:** Cross-tenant data leak, secrets in logs, verbose errors.
- **Mitigation:** Tenant isolation by DB + RLS, log redaction, production error masking, no stack traces to client.

### Denial of Service

- **Threat:** Resource exhaustion via API flood, large payloads, queue spam.
- **Mitigation:** Rate limiting per IP/tenant/user, payload limits, timeouts, circuit breakers, HPA, resource quotas.

### Elevation of Privilege

- **Threat:** User gains admin or another tenant access.
- **Mitigation:** RBAC/ABAC, backend authorization, tenant context from JWT, object-level permissions.

## Component-Specific Threats

### API

- Missing authn → all endpoints exposed.
- Mass assignment → extra fields accepted.
- SSRF on outbound calls.
- Mitigations: global auth guard, strict DTOs, Zod validation, outbound URL validation, rate limiting.

### Socket.IO / Realtime

- Unauthenticated connection → join any room.
- Tenant ID spoofing via payload.
- Message flooding.
- Mitigations: JWT handshake auth, tenantId from token, room authorization, payload limits, message rate limits.

### Workers / Queues

- Job data with arbitrary tenantId processed.
- Replay of jobs.
- Mitigations: validate tenantId against catalog, idempotency, dedupe, audit job execution.

### PostgreSQL

- Missing tenant filter → cross-tenant query.
- Direct DB access via leaked creds.
- Mitigations: RLS, foreign keys, every query filters by tenant_id, credential rotation, encrypted backups.

### Redis

- Unauthenticated Redis in dev → data leak.
- Mitigations: Redis AUTH, TLS in transit, separate DB/index per purpose, no secrets stored.

### Webhooks

- Signature bypass, replay, delay.
- Mitigations: HMAC-SHA256 signature, timestamp window, idempotency by event ID, raw body preservation.

### CI/CD

- Secret leakage, dependency confusion, tampered image.
- Mitigations: secret scan, dependency audit, signed images, SBOM, immutable tags/digests.

## Attack Trees (examples)

1. Cross-tenant data access
   - Forge tenant_id header → blocked by auth/context
   - Use leaked token of tenant A → still scoped to tenant A
   - Exploit missing tenant predicate in query → blocked by RLS

2. Account takeover
   - Brute force password → blocked by rate limiting + Argon2id
   - Steal refresh token → blocked by rotation + binding
   - XSS steal access token → blocked by short expiry + HttpOnly refresh

## Validation

Review this model:

- Before each major feature.
- After security incidents.
- Quarterly.
