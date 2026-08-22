---
description: "Dependency evaluation, installation, and upgrade rules"
trigger: model_decision
---

# Dependencies Rules

- Use only official registries and official repositories of maintainers.
- Pin exact versions in `package.json`; version the lockfile.
- No prerelease, beta, RC, or canary without explicit approval.
- Prefer packages published at least 7 days ago.
- Run `pnpm audit` before adding or upgrading structural dependencies.
- Document alternatives and reason for choice in `docs/adr/` for structural packages.
- Avoid floating ranges (`latest`, `*`, unbounded `>=`).
- Never install packages from unknown forks or unlicensed code.
