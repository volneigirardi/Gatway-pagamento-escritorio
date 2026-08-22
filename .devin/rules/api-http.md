---
description: "REST API design, versioning, and contract rules"
trigger: model_decision
---

# API HTTP Rules

- All routes under `/api/v1/`.
- Use NestJS controllers with Fastify adapter.
- Request/response contracts defined in `contracts` package using Zod.
- Return consistent envelope: `{ data, error, meta }`.
- OpenAPI generated from decorators is the source of truth for client generation.
- Versioned breaking changes go to `/api/v2/`.
- Use HTTP verbs correctly. Use plural resource names.
- Pagination: cursor-based for large collections.
- Idempotency-Key header accepted for mutating endpoints.
- Rate limiting per tenant and per IP.
