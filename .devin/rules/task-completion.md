---
description: "Task completion and handoff rules"
trigger: always_on
---

# Task Completion Rules

- Never claim a task is complete without verifiable evidence.
- Before finishing:
  - Run `git diff` and review the diff.
  - Run relevant tests or explain why not applicable.
  - Run relevant skills/subagents for review.
  - Update documentation if behavior changed.
  - Update `docs/project-state.md` if phase, modules, integrations, risks, or debts changed.
- Summarize what was done, evidence, risks, and pending decisions.
- Report failures honestly. Do not hide errors.
- Do not push, deploy, or run destructive operations without explicit approval.
