# ADR-004: Monorepo tooling

## Status

Accepted

## Context

Fase 3 precisava de scaffold técnico multi-deployable com builds e testes independentes.

## Decision

Usar pnpm workspaces + Nx para task graph e cache. TypeScript strict compartilhado via `@saas/typescript-config`. ESLint flat config via `@saas/eslint-config`.

## Consequences

- Pro: isolamento de apps/packages, builds incrementais, dependências centralizadas.
- Con: curva inicial de configuração; hooks de build exigem aprovação (pnpm `onlyBuiltDependencies`).

## Alternatives consideradas

Turborepo vs Nx; escolhemos Nx por task graph e cache local nativos.
