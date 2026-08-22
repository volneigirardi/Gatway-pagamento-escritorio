---
name: session-handoff
description: Update project memory for the next session
triggers:
  - user
  - model
allowed-tools:
  - read
  - exec
---

Prepare a handoff for the next session.

1. Read `docs/project-state.md`.
2. Run `git status --short` and `git log --oneline -5`.
3. Summarize what was done, what is in progress, and what is blocked.
4. Update `docs/project-state.md` with:
   - Current phase
   - Decisions made or pending
   - Modules/integrations added or changed
   - Risks and debts
   - Last verification date
   - Next approved step
5. Keep the update concise. Do not turn it into a conversation transcript.

Do not invent state not present in files or git.
