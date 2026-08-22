---
description: "Debugging protocol to avoid infinite debug loops"
trigger: model_decision
---

# Debugging Protocol

Follow this protocol for any bug or unexpected behavior:

1. Reproduce the issue reliably.
2. Capture the exact error, logs, and stack trace.
3. Identify the last relevant change.
4. Formulate a hypothesis.
5. Record evidence for and against the hypothesis.
6. Make the smallest possible change.
7. Reproduce again.
8. Compare before and after.
9. Run regression tests.

After two failed fixes:

- Stop modifying code.
- Re-examine the hypothesis.
- Check official docs, dependency versions, and environment config.
- Produce a new hypothesis before touching code again.

After three failed hypotheses:

- Stop completely.
- Summarize: what is proven, what was tested, what was discarded, files changed, changes to revert, missing info.
- Ask for guidance.

Never hide failures or claim a fix works without evidence.
