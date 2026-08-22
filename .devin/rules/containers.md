---
description: "Docker and container rules"
trigger: glob
paths:
  - "infra/docker/**/*"
  - "**/Dockerfile"
  - "**/Dockerfile.*"
---

# Container Rules

- Multi-stage Dockerfiles with a single Node.js process per container.
- Do not use PM2 inside containers.
- Containers must be stateless.
- Run as a non-root user.
- Use read-only filesystem where possible.
- Handle SIGTERM and shut down gracefully.
- Pin base image versions and digests where possible.
- Health checks must call `/health/ready` or equivalent.
- No secrets baked into images.
