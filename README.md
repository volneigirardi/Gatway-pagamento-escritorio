# SaaS Enterprise Foundation

Multi-tenant enterprise SaaS foundation designed for long-term growth, security, and performance.

## Overview

This repository contains the foundation for an enterprise SaaS product targeting the regulated financial/fintech sector. It uses a modular monolith architecture with separate deployables for HTTP API, workers, real-time gateway, scheduler, and migrations.

## Approved Stack

- **Runtime:** Node.js 24 LTS, TypeScript strict
- **Package Manager:** pnpm 11
- **Monorepo:** pnpm workspaces + Nx
- **Backend:** NestJS with Fastify
- **Database:** PostgreSQL 18, Kysely query builder, `pg` driver
- **Cache/Queues:** Redis, BullMQ
- **Realtime:** Socket.IO with Redis adapter
- **Web:** React 19, Vite, TanStack Router/Query, Tailwind, Radix primitives
- **Mobile:** React Native with Expo (New Architecture, Hermes)
- **Observability:** OpenTelemetry, Pino, Prometheus/Grafana
- **Infrastructure:** Docker multi-stage, Docker Swarm, Kubernetes/Helm

## Project Structure

```
/
├── apps/           # Deployable applications
├── packages/       # Shared libraries
├── database/       # Migrations and seeds
├── infra/          # Docker, Swarm, Kubernetes manifests
├── docs/           # Architecture, ADRs, runbooks, specs
└── .devin/         # Agent governance (rules, skills, agents, hooks)
```

## Governance

All work must follow the rules in `AGENTS.md` and `.devin/rules/`. When starting a new task, consult `docs/project-state.md` and the relevant skills.

## Getting Started

> Not yet available. The project is currently in the governance/foundation phase.

## License

Private — All rights reserved.
