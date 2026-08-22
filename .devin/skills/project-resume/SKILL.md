---
name: project-resume
description: Summarize the current project state from versioned memory
triggers:
  - user
  - model
allowed-tools:
  - read
---

Summarize the project state for the user or another agent:

1. Read `docs/project-state.md`.
2. Read `docs/project-context.md` if it exists.
3. Read `docs/glossary.md` for key terms.
4. Return a concise summary with:
   - Current phase
   - Approved architecture and stack
   - Existing modules and integrations
   - Open risks and decisions
   - Next approved step
   - Date of last update

Do not invent information not present in the files.
