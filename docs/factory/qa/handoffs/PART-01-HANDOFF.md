# Handoff — Parte 1 — Descoberta e Baseline

## Status

- **Parte:** 1 de 9
- **Título:** Descoberta, baseline e mapa completo do sistema
- **Status:** APROVADA com bloqueadores baseline documentados (Q01, Q02)
- **Data:** 2026-08-30
- **Branch avaliada:** `master`
- **Source SHA:** `7a12564260bf9508f77b615fd74e6a2bcc8455d5`

## Resumo Executivo

A Parte 1 mapeou o repositório Integre, confirmou a stack real, executou os comandos documentados e produziu a baseline documental em `docs/factory/qa/`. O sistema é funcional localmente: lint, typecheck, unit tests, build e E2E passam. Dois itens preexistentes foram registrados como baseline: falha no `format:check` e um teste de integração com assertion bug. Nenhum segredo foi encontrado. Nenhuma dependência foi instalada.

## Comandos Executuíveis para Retestar

```powershell
# Ambiente
node --version              # v24.18.0
pnpm --version              # 11.15.1
docker --version            # 29.7.2

# Qualidade estática
pnpm format:check           # FAIL baseline Q01
pnpm lint                   # PASS
pnpm typecheck              # PASS

# Testes
pnpm test                   # PASS
pnpm --filter @saas/api test:integration   # FAIL baseline Q02
pnpm --filter @saas/web test:e2e           # PASS

# Build
pnpm build                  # PASS
```

## Mapa do Sistema (sintético)

- **Deployables:** `api`, `web`, `worker`, `scheduler`, `realtime`, `mobile`.
- **Pacotes críticos:** `@saas/auth`, `@saas/database`, `@saas/contracts`, `@saas/outbox`, `@saas/http-client`, `@saas/webhooks`, `@saas/ui-web`, `@saas/observability`.
- **Módulos operacionais:** auth, plans, tenants, billing, reporting, tenant-portal.
- **Banco:** PostgreSQL 18, Kysely, database-per-tenant + catalog central, RLS forçado.
- **Cache/Filas/Realtime:** Redis, BullMQ, Socket.IO.
- **CI/CD:** GitHub Actions com quality gates, security scans, integration, E2E, container scan/SBOM, manifest validation.

## Bloqueadores Baseline

| ID | Problema | Local | Ação Necessária |
|----|----------|-------|-----------------|
| Q01 | `pnpm format:check` falha | `.devin/scripts/auto-commit.js` | Corrigir formatação em passo de higiene e reexecutar |
| Q02 | Assertion bug em teste de migração | `apps/api/test/admin-migrations.integration.spec.ts:458` | Confirmar intenção com dev e corrigir expectation de 6 para 5, ou ajustar teste |

## Decisões Pendentes para a Parte 2

1. Aprovar criação da skill do agente QA em `.agents/skills/qa/SKILL.md`.
2. Aprovar local do playbook `qa-cycle.devin.md` (sugestão: `.devin/playbooks/qa-cycle.devin.md`).
3. Aprovar branch dedicada para o sistema de QA (sugestão: `feature/qa-agent-system`).

## Próximos Passos (Parte 2)

- Criar contrato do agente QA (regras, escopo, autoridade, limites).
- Criar `.agents/skills/qa/SKILL.md` com instruções operacionais.
- Criar playbook `qa-cycle.devin.md`.
- Criar blueprint declarativo (`initialize`, `maintenance`, `knowledge`).
- Garantir estrutura executável inicial (scripts/utilitários de QA) sem instalar dependências de negócio.

## Nada para Lembrar da Sessão

Toda informação deste handoff e dos artefatos em `docs/factory/qa/` é persistente. A próxima sessão deve:

1. Anexar o mesmo repositório (`C:\Projeto-Saas`).
2. Ler `docs/factory/qa/handoffs/PART-01-HANDOFF.md`.
3. Reexecutar o diff da árvore de trabalho (`git status --short`).
4. Confirmar que os bloqueadores Q01/Q02 ainda existem antes de começar a Parte 2.
