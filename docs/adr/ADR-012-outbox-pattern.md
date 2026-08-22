# ADR-012: Transactional Outbox Pattern

## Status

Accepted

## Context

Domain events must be reliably published without leaking outside transactions.

## Decision

- Use PostgreSQL `outbox` table in tenant database.
- Business transactions write events to outbox; separate worker polls and publishes.
- `@saas/outbox` package provides publisher and relay.
- Events are versioned (`v1.<domain>.<event>`) and validated with Zod.

## Consequences

- Positive: exactly-once-ish processing, resilience, auditability.
- Negative: introduces latency and requires worker infrastructure.
