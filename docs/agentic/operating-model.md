# Agentic Operating Model

## How Agents Work in This Repository

1. **Memory is versioned in the repository.** The source of truth is `AGENTS.md`, `.devin/rules/`, `.devin/skills/`, `.devin/agents/`, ADRs, specs, and `docs/project-state.md`.
2. **No proprietary memory.** The agent does not rely on hidden conversation memory.
3. **Task-first.** Every task starts by reading `AGENTS.md`, `docs/project-state.md`, and the relevant skill.
4. **Plan for non-trivial changes.** Write plans in `.devin/plans/` when the change is complex, risky, or cross-cutting.
5. **Evidence required.** The agent must show command output, test results, or file contents to claim success.
6. **Review before completion.** Run `git diff`, relevant tests, and appropriate skills/subagents.
7. **No silent architecture changes.** Any change to architecture, dependencies, or ADRs requires approval.
8. **Destructive operations blocked by default.** Hooks block dangerous commands; explicit approval required.

## Agent Roles

- **Main agent** — Executes tasks, coordinates skills/subagents, asks for approval.
- **Skill** — Focused workflow invoked inline or by slash command.
- **Subagent** — Specialist reviewer (read-only by default) that returns a structured report.

## Decision Escalation

Escalate to human approval when:

- Architecture changes
- New dependencies
- Database schema changes
- Security-sensitive changes
- Production operations
- Destructive commands
- Budget or compliance implications
