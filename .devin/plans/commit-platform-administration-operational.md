# Commit Platform Administration and Operational Foundation

**Status: In progress**

## Objective

Validate, remediate, and commit the complete pending Platform Administration, authentication, tenant provisioning, billing/reporting, web UI, PostgreSQL, infrastructure, governance, and documentation work as one coherent operational checkpoint.

## Scope

- API modules: authentication, plans, tenants, billing, reporting, tenant portal, shared Redis/database/idempotency infrastructure.
- Worker: platform outbox relay and tenant provisioning.
- Database: admin/tenant migrations, runtime/migration/provisioning roles, pools, RLS, indexes, and migration tooling.
- Web/design system: authenticated platform/tenant routes, dashboards, components, stories, responsive/accessibility behavior.
- Infrastructure: Docker, Compose, Kubernetes, runtime secrets/configuration.
- Governance and documentation: mandatory DBA gate, ADRs, runbooks, state, security and database standards.
- Dependency/lockfile updates.

## Required Gates

1. Inspect all changed/untracked files and check for accidental generated artifacts or secrets.
2. Run formatting check, lint, typecheck, unit tests, build, and E2E.
3. Run PostgreSQL/Redis-backed API integration and worker provisioning integration tests.
4. Validate migration zero/up/down/up, tenant isolation, runtime roles, and configuration.
5. Run dependency audit and document pre-existing/unresolved advisories.
6. Run specialist reviews: PostgreSQL DBA, appsec, tenant isolation, architecture, frontend/accessibility, performance/network, and reliability.
7. Resolve all critical/high findings and rerun affected gates/reviews.
8. Review final diff, stage all intended files, scan staged content for secrets, and commit using the established attribution format.

## Commit Acceptance

- No failing required check.
- Final `postgres-dba` verdict is `PASS` or `PASS WITH RISKS`.
- No unresolved critical/high specialist finding.
- Any accepted medium risk is explicitly documented.
- Staged files match the intended scope; no real secret or local/generated artifact is included.
- Commit succeeds and the working tree is clean, except for explicitly documented exclusions.

## Non-goals

- No production access, deployment, migration, secret rotation, or destructive database operation.
- No push unless separately and explicitly requested.
