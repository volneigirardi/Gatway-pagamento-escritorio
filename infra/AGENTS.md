# Infrastructure Rules

- Docker multi-stage builds; one Node.js process per container.
- Containers run as non-root with read-only filesystem when possible.
- Graceful shutdown and SIGTERM handling.
- Pin base images by digest when possible.
- Docker Compose for development; Docker Swarm stack; Kubernetes manifests/Helm.
- Secrets and configs externalized; never commit credentials.
- Migrations run as a one-shot Job, never in every replica.
