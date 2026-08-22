# ADR-005: Backend framework and runtime

## Status

Accepted

## Context

API, worker, scheduler e realtime compartilham stack mas são deployables separados.

## Decision

NestJS com FastifyAdapter para API e realtime; NestJS application context para worker/scheduler. BullMQ para jobs e schedules. Socket.IO com Redis adapter para realtime. Pino para logs.

## Consequences

- Pro: estrutura modular, injeção de dependência, desligamento ordenado.
- Con: overhead de decorators; exige `experimentalDecorators`.

## Riscos

Fastify e @fastify plugins devem estar alinhados; validar com lockfile.
