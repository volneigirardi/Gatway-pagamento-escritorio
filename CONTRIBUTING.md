# Contributing Guide

This document defines how agents and humans work in this repository.

## Before Starting

1. Read `AGENTS.md` and the relevant scoped `AGENTS.md` files.
2. Check `docs/project-state.md` for the current phase and open decisions.
3. Identify the relevant skill in `.devin/skills/` and invoke or follow it.
4. For new features, fill out `docs/specs/TEMPLATE.md` and get approval before coding.

## Workflow

1. **Plan:** Write or update the task plan in `.devin/plans/` when the change is non-trivial.
2. **Branch:** Create a feature branch from `main`. Do not commit directly to `main`.
3. **Implement:** Make the smallest coherent change. Do not refactor unrelated code.
4. **Test:** Add or update tests. Never disable tests to make them pass.
5. **Review:** Run `git diff` and self-review before finishing. Run relevant skills/agents.
6. **Document:** Update ADRs, specs, or runbooks when behavior changes.
7. **Commit:** Use conventional commits. Do not include secrets.

## Prohibited Actions

- Never commit secrets, passwords, tokens, or private keys.
- Never run migrations or destructive commands against production without approval.
- Never skip tenant isolation tests.
- Never introduce a new pattern when an equivalent approved pattern exists.
- Never hide failures or claim success without evidence.

## Approval Gates

The following require explicit human approval:

- Changes to architecture or ADRs.
- New dependencies or dependency upgrades.
- Database schema changes.
- Production deploys or push.
- Destructive operations (drop, truncate, reset, force push).

## Code Standards

- TypeScript strict mode everywhere.
- English identifiers, comments, file names, and technical terms.
- Portuguese (Brazil) for user-facing explanations.
- Automated tests for security-critical paths, especially tenant isolation.
