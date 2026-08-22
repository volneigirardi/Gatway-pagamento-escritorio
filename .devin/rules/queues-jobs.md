---
description: "BullMQ job and queue rules"
trigger: model_decision
---

# Queues and Jobs Rules

- Use BullMQ as the job framework backed by Redis.
- All jobs are idempotent. Use deterministic `jobId` based on idempotency key when available.
- Jobs carry a validated `tenant_id`.
- Workers log start, success, and failure with Pino; record failures in `job_logs`.
- Dead Letter Queue for repeated failures; support manual retry.
- Support SIGTERM graceful shutdown with `shutdownTimeout`.
- Queue names are kebab-case and versioned if breaking changes occur.
- Scheduler uses BullMQ repeatable jobs; no cron libraries elsewhere.
