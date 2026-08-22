---
description: "Docker Swarm and Kubernetes deployment rules"
trigger: glob
paths:
  - "infra/swarm/**/*"
  - "infra/kubernetes/**/*"
  - "infra/traefik/**/*"
---

# Swarm and Kubernetes Rules

- Docker Compose for development; Docker Swarm stack for Swarm; Helm/Kustomize for Kubernetes.
- Traefik as reverse proxy when approved.
- Health checks, resource requests/limits, HPA, PDB, anti-affinity, NetworkPolicy.
- Secrets managed via Swarm secrets, Sealed Secrets, or External Secrets Operator.
- Migration Job runs once per deploy, never in every replica.
- Graceful rolling updates with readiness gates.
- Separate staging and production namespaces/environments.
- Production changes require runbook and approval.
