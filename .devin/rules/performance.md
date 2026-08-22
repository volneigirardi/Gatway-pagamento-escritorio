---
description: "Performance and efficiency rules"
trigger: model_decision
---

# Performance Rules

- Paginate all list endpoints with cursor-based pagination.
- Avoid N+1 queries; use joins or batched selects.
- Compress API responses with Brotli/Gzip.
- Use Redis cache for frequently read data with explicit invalidation.
- Lazy load routes and heavy components on web.
- Minimize re-renders on mobile; use memo where beneficial.
- Connection pooling for PostgreSQL and Redis.
- Implement timeouts and circuit breakers for external calls.
- Measure before optimizing; add telemetry spans around slow paths.
