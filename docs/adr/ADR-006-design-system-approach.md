# ADR-006: Design system approach

## Status

Proposed

## Context

O usuário exigiu três direções visuais antes de congelar identidade.

## Decision

Criar três temas JSON em `@saas/design-tokens` (Professional, Vibrant, Dark Elegant) e demonstrá-los via Storybook em `@saas/ui-web`. shadcn/ui usado como base estrutural, não visual. Fontes com licença livre serão documentadas antes de uso em produção.

## Consequences

- Pro: decisão informada pelo usuário, tokens versionáveis, dark mode integrado.
- Con: trabalho extra para manter três variações enquanto identidade não é aprovada.

## Próximos passos

Usuário deve escolher uma direção visual para evoluir o design system completo.
