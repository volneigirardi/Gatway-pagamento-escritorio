# Kubernetes

Base manifests for `api`, `realtime`, `worker`, and `scheduler`, managed with
Kustomize (`kubectl kustomize` ships with `kubectl`, no separate install
needed).

## Layout

```
base/
  namespace.yaml
  serviceaccount.yaml
  configmap.yaml
  secret.yaml.example   # template only — never commit real secrets
  deployment-api.yaml / service-api.yaml
  deployment-realtime.yaml / service-realtime.yaml
  deployment-worker.yaml
  deployment-scheduler.yaml
  job-migrate.yaml       # applied on demand, not part of the base kustomization
  hpa.yaml
  pdb.yaml
  networkpolicy.yaml
  kustomization.yaml
```

## Usage

```bash
# Render manifests
kubectl kustomize infra/kubernetes/base

# Create the namespace + secret out-of-band first (see secret.yaml.example),
# then apply the base:
kubectl apply -k infra/kubernetes/base

# Run migrations once, before rolling out a Deployment revision that needs
# the new schema (rename the Job per revision to avoid name collisions):
kubectl apply -f infra/kubernetes/base/job-migrate.yaml
kubectl wait --for=condition=complete job/migrate -n saas --timeout=300s
kubectl delete -f infra/kubernetes/base/job-migrate.yaml
```

## Design notes

- All containers run as non-root (`runAsUser: 1001`, matching the Dockerfile
  users), with `readOnlyRootFilesystem: true` and all Linux capabilities
  dropped.
- `api` and `realtime` have `startupProbe` + `readinessProbe` (hit
  `/api/v1/health/ready` and `/health/ready`, which check dependencies) and
  `livenessProbe` (hits the lightweight `.../health/live`), matching the
  Terminus-based health checks in `apps/api` and the Redis-ping check in
  `apps/realtime`.
- `realtime` has a `preStop` hook (`sleep 10`) so the Service has time to
  remove the pod from Endpoints (readiness probe starts failing on SIGTERM
  via `app.enableShutdownHooks()`) before existing WebSocket connections are
  torn down — see ADR references in `docs/performance/realtime.md`.
- `scheduler` runs with a single replica and `strategy: Recreate` to avoid
  two schedulers double-firing repeatable jobs during a rolling update.
- `NetworkPolicy` denies all ingress/egress by default per namespace, then
  allows only: DNS, ingress controller -> api/realtime, and app -> Postgres
  (5432) / Redis (6379) / OTLP collector (4318) / HTTPS (443). Replace the
  `ipBlock: 0.0.0.0/0` egress rule with a `namespaceSelector`/`podSelector`
  matching your actual data-plane location once it is decided (managed
  Postgres/Redis vs. in-cluster).
- Secrets are never committed. `secret.yaml.example` documents the expected
  keys; use `kubectl create secret` or an external secret manager (Vault,
  AWS/GCP Secrets Manager via the External Secrets Operator) in real
  environments.

## Multi-tenant migration gap

`infra/docker/Dockerfile.migrate` and `job-migrate.yaml` run migrations
against a single database (the connection string in `DATABASE_URL`). Since
this project uses database-per-tenant, iterating every tenant database is
**not yet automated** — see `docs/database/migration-standards.md`. Until a
tenant catalog/provisioning flow exists, an operator must run the Job once
per tenant connection string (and once for the `admin` target).

## Status

These manifests were authored and validated with `kubectl kustomize` (schema
and templating correctness) in this environment, but have **not** been
applied to a live cluster — there is no cluster available here. Treat probe
paths, resource requests/limits, and the NetworkPolicy egress rule as
starting points to tune against real load and your cluster's CNI/DNS setup.
