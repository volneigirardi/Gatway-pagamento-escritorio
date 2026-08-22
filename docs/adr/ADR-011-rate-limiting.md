# ADR-011: Rate Limiting

## Status

Accepted

## Context

API and realtime endpoints need protection against abuse and DoS.

## Decision

- Application-level rate limiting via Redis-backed `@nestjs/throttler`.
- Default limit: 100 requests per minute per IP.
- Future: per-tenant and per-user tiers.
- Traefik ingress rate limiting as first line of defense.

## Consequences

- Positive: scalable, configurable per environment.
- Negative: adds Redis dependency; misconfiguration can block legitimate traffic.
