# Handoff — Parte 3 — Memória persistente, organizacional, grafo, Second Brain e RAG

## Status

- **Parte:** 3 de 9
- **Título:** Sistema profissional de memória
- **Status:** BLOQUEADA — implementação concluída e commitada, mas gate `postgres-dba` final não pôde ser reexecutado
- **Data:** 2026-08-30
- **Branch:** `master`
- **Source SHA:** `8e02669bbd2afabe2e317907e9ce3b060fb0d1d8`
- **Parte 2 SHA:** `16fedeb7d776486aa2dab67d96199d203b4f3209`
- **Parte 1 SHA:** `7a12564260bf9508f77b615fd74e6a2bcc8455d5`

## Resumo Executivo

A Parte 3 implementou um sistema híbrido de memória para o QA Gatekeeper, combinando memória persistente relacional, memória organizacional, grafo de conhecimento, Second Brain e RAG seguro. O backend escolhido foi PostgreSQL 18 com pgvector em um schema dedicado `qa_` dentro da instância de homologação/QA. Todos os artefatos foram criados, os testes do pacote `@saas/qa-agent` passam (30 testes, incluindo 6 de integração com Testcontainers), e as migrations aplicam e revertem corretamente.

O commit `8e02669` já inclui toda a implementação e os ajustes de roles necessários para que o schema `qa_` funcione no modelo de separação de papéis do projeto (`blupo_migrator` / `blupo_app`).

## Decisões e ADR

- **ADR-018**: PostgreSQL dedicado com schema `qa_` e pgvector como backend de memória do QA.
- Fontes de verdade versionadas têm precedência sobre sumários derivados.
- Nenhum segredo, token, PII ou dado real de cliente entra nos embeddings.
- Deduplicação por hash de conteúdo, invalidação por fingerprint, auditoria de escrita.

## Arquivos Criados ou Alterados (principais)

### Schema e migrations

- `database/migrations/qa/001_create_qa_schema.ts`
- `database/migrations/qa/002_create_qa_entities_and_relations.ts`
- `database/migrations/qa/003_create_qa_memory_and_test_records.ts`
- `database/migrations/qa/004_create_qa_embeddings_fingerprints_audit.ts`
- `database/scripts/run-migrations.ts` — tabela de migration por target (`kysely_migration_<target>`)
- `packages/database/src/roles.ts` — criação do schema `qa_`, grants, extensão vector defensiva

### Pacote `@saas/qa-agent`

- `packages/qa-agent/src/config.ts`
- `packages/qa-agent/src/db-schema.ts`
- `packages/qa-agent/src/db.ts`
- `packages/qa-agent/src/sanitize.ts`
- `packages/qa-agent/src/fingerprint.ts`
- `packages/qa-agent/src/memory-store.ts`
- `packages/qa-agent/src/commands.ts`
- `packages/qa-agent/src/index.ts`
- `packages/qa-agent/test/memory-store.integration.spec.ts`
- `packages/qa-agent/test/migrator.ts`

### Infra e scripts

- `infra/docker/docker-compose.dev.yml` — imagem `pgvector/pgvector:pg18`, serviço `migrate-qa`
- `database/package.json` — scripts `migrate:qa`, `migrate:qa:down`, `migrate:qa:status`
- `package.json` — scripts `db:migrate:qa`, `db:migrate:qa:down`, `db:migrate:qa:status`
- `packages/database/package.json` — alinhamento do `pg` para `8.23.0`

### Documentação

- `docs/adr/ADR-018-qa-memory-backend.md`
- `docs/factory/agents/qa/MEMORY.md`
- `.gitignore` — adicionado `.admin-master.txt` e `.secrets/`

## Comandos Validados

```powershell
# Pacote QA
pnpm nx run @saas/qa-agent:lint      # PASS
pnpm nx run @saas/qa-agent:typecheck # PASS
pnpm nx run @saas/qa-agent:test      # PASS (30 tests)
pnpm nx run @saas/qa-agent:build     # PASS

# Banco de dados compartilhado
pnpm nx run @saas/database:typecheck # PASS

# Roles e migrations contra postgres:18.4
$env:DATABASE_ADMIN_URL="postgres://postgres:test@localhost:5445/saas_test"
$env:APP_DATABASE_PASSWORD="app-password-32-characters-long!!!"
$env:MIGRATION_DATABASE_PASSWORD="migration-password-32-characters!!"
$env:PROVISIONER_DATABASE_PASSWORD="provisioner-password-32-characters"
pnpm --filter @saas/database-migrations roles:bootstrap # PASS

$env:MIGRATION_DATABASE_URL="postgres://blupo_migrator:migration-password-32-characters!!@localhost:5445/saas_test"
node --experimental-strip-types database/scripts/run-migrations.ts up admin # PASS (10 migrations)
node --experimental-strip-types database/scripts/run-migrations.ts up qa    # PASS (4 migrations)
node --experimental-strip-types database/scripts/run-migrations.ts down qa  # PASS (rollback 004)

# Testcontainers com pgvector/pgvector:pg18
pnpm nx run @saas/qa-agent:test      # PASS — inclui memory-store.integration.spec.ts
```

## Evidências de Segurança e Isolamento

- `sanitize.ts` rejeita padrões de segredos (JWT, API keys, senhas, tokens) antes da persistência.
- O schema `qa_` é tenant-agnóstico por decisão arquitetural (não armazena dados de cliente).
- `blupo_app` recebe apenas `USAGE` no schema e DML nas tabelas, com `audit_log` append-only (`SELECT/INSERT`).
- `blupo_migrator` recebe `USAGE, CREATE` no schema `qa_` para possuir objetos das migrations.
- A criação da extensão `vector` é defensiva: verifica `pg_available_extensions` e captura `insufficient_privilege`; ambientes sem pgvector continuam funcionando sem a coluna/index vector.

## Bloqueadores

| ID     | Severidade   | Problema                                                                                                                                                    | Ação                                                                                                                        |
| ------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| DBA-03 | **critical** | Gate `postgres-dba` final não pôde ser reexecutado após os ajustes; o subagente foi rejeitado pela ferramenta                                               | Reinvocar o `postgres-dba` subagente contra o SHA `8e02669` e obter veredicto formal (`PASS` / `PASS WITH RISKS` / `BLOCK`) |
| B01    | medium       | `pnpm format:check` falha em `.devin/scripts/auto-commit.js`                                                                                                | Corrigir formatação em passo de higiene (pré-existente)                                                                     |
| B02    | medium       | Assertion bug em `apps/api/test/admin-migrations.integration.spec.ts:458`                                                                                   | Confirmar intenção com dev e ajustar (pré-existente)                                                                        |
| B03    | high         | Arquivo não-rastreado `.admin-master.txt` contém credencial `admin@blupo.local:...` no workspace; diretório `.secrets/` com chaves JWT/MFA também detectado | Investigar origem, rotacionar se sensível, manter apenas em Devin/CI Secrets; `.gitignore` já os bloqueia                   |

> **Nota sobre o commit:** o commit `8e02669` foi realizado durante a sessão com a implementação completa. A mensagem de commit registra que a reavaliação do `postgres-dba` foi tentada mas o subagente foi rejeitado pela ferramenta. Por isso, a Parte 3 permanece **BLOQUEADA** até que o gate DBA seja concluído formalmente.

## Próximos Passos (após desbloqueio)

1. Reexecutar o gate `postgres-dba` contra os arquivos do SHA `8e02669`.
2. Se o veredicto for `BLOCK`, corrigir os achados críticos/alto e reinvocar o gate.
3. Se o veredicto for `PASS WITH RISKS`, documentar riscos aceitos com mitigação e owners.
4. Apenas então atualizar este handoff para `PARTE_03_APROVADA` e receber a Parte 4.

## Como Retomar

1. Anexar `C:\Projeto-Saas`.
2. Ler `docs/factory/qa/00-stage-state.yaml` e este handoff.
3. Executar `git status --short` e verificar que `.admin-master.txt` e `.secrets/` não foram versionados.
4. Reinvocar o subagente `postgres-dba` para o SHA `8e02669`.
5. Após veredicto favorável, atualizar `docs/factory/qa/00-stage-state.yaml` e este handoff.

---

STATUS: PARTE_03_BLOQUEADA
AÇÃO: Não envie nem execute a PARTE 4. Reabra o gate `postgres-dba`, resolva os bloqueadores e solicite revalidação.
