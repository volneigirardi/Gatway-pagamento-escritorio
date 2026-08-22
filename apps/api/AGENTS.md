# API App Rules

- Use NestJS with FastifyAdapter.
- All routes must be versioned under `/api/v1/`.
- Controllers must be thin; business logic lives in services.
- DTOs must be shared via `contracts` package and validated with Zod.
- Authentication context (`user`, `tenant_id`, `permissions`) must be injected by guards.
- Every service method that touches tenant data must receive and filter by `tenant_id`.
- Return consistent JSON envelopes: `{ data, error, meta }`.
- Health checks: `/health/live` and `/health/ready`.
- OpenAPI spec is the source of truth for client generation.
