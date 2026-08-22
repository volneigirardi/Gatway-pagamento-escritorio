---
description: "Logging, metrics, tracing, and alerting rules"
trigger: model_decision
---

# Observability Rules

- Use Pino for structured JSON logs in all Node.js processes.
- Carry `correlation_id` across every request and job.
- Include `tenant_id` and `user_id` in logs only when safe.
- OpenTelemetry traces for API, workers, realtime, scheduler, and database calls.
- Prometheus metrics for latency, errors, queue depth, connection pool, etc.
- Separate liveness and readiness health checks.
- Alerts for error rate, latency p95, queue backlog, and DB connection saturation.
- Sensitive data must never be logged.
