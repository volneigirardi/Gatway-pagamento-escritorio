# Mandatory PostgreSQL DBA Review

**Status: Implemented**

## Objective

Make the `postgres-dba` specialist a mandatory review gate for every change that can affect PostgreSQL correctness, security, tenant isolation, operability, or performance.

## Current Gap

The repository already defines `.devin/agents/postgres-dba.md` and database review skills, but `.devin/rules/database.md` uses `model_decision` and permits either the `database-review` skill or the `postgres-dba` subagent. Pre-commit and quality-gate workflows do not explicitly require DBA evidence. This allows a database-related task to finish without the specialist subagent running.

## Changes

1. Make the database governance rule always-on and define the complete database-impact scope.
2. Require both the appropriate database skill and a final `postgres-dba` subagent review; the skill does not replace the specialist.
3. Strengthen the DBA profile for PostgreSQL 18 performance, security, RLS/roles, multi-tenancy, migrations, locks, pools, maintenance, backup/restore, and evidence-based query analysis.
4. Add the mandatory gate to root/scoped AGENTS rules and task-completion, pre-commit, and quality-gate workflows.
5. Update agentic catalogs, operating model, project memory, and an accepted ADR recording the decision.
6. Run the `postgres-dba` subagent against the resulting governance and resolve blocking findings.

## Acceptance Criteria

- Database rules load for every session.
- Any database-impacting task must run `postgres-dba` after implementation and before completion, commit, or merge.
- Critical/high findings block completion; medium findings must be fixed or explicitly accepted and documented.
- Review output must cite changed files and evidence; no review may be claimed without actual subagent output.
- Non-trivial queries require `EXPLAIN` evidence from a safe non-production environment when available.
- Tenant isolation, RLS/role separation, indexes, constraints, locking, pool sizing, backup/restore, and rollback are explicitly reviewed.
- Governance docs and project state remain consistent.

## Verification

- Validate all modified Markdown/frontmatter and JSON where applicable.
- Search for contradictory `database-review OR postgres-dba` language.
- Invoke the `postgres-dba` subagent on the final diff.
- Run `git diff --check`, inspect `git diff`, and report evidence.
