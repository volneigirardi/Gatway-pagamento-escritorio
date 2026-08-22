---
name: network-review
description: Review networking, ingress, and container configuration
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Review networking and infrastructure configuration.

1. Check TLS, CORS, and security headers.
2. Verify ingress configuration exposes only intended endpoints.
3. Check internal service communication (mTLS, network policies).
4. Verify rate limiting at ingress and application layers.
5. Check container non-root, read-only FS, and resource limits.
6. Review graceful shutdown and health probes.
7. Check Swarm/Kubernetes manifests for anti-affinity, PDB, HPA.
8. Report findings with file paths and line numbers.

Do not modify code unless asked.
