---
name: bugfix
description: Follow the debugging protocol to fix a bug
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
  - edit
---

Fix a bug following the debugging protocol.

1. Reproduce the issue reliably.
2. Capture exact error, logs, and stack trace.
3. Identify the last relevant change.
4. Formulate a hypothesis.
5. Record evidence.
6. Make the smallest possible change.
7. Reproduce again.
8. Compare before and after.
9. Run regression tests.

If two fixes fail:

- Stop modifying code.
- Re-examine hypothesis and check official docs, dependency versions, environment config.
- Produce a new hypothesis before touching code.

If three hypotheses fail:

- Stop completely.
- Summarize: proven facts, tests run, discarded hypotheses, files changed, changes to revert, missing information.
- Ask for guidance.

Never claim a fix works without running the reproduction.
