---
description: "Trusted sources for technical decisions"
trigger: model_decision
---

# Source Trust Rules

- Use only official documentation, official repositories, official release notes, and official advisories.
- Allowed: npm registry metadata, GitHub Security Advisories, CVE/NVD/OSV, OWASP, official project docs.
- Prohibited as sole truth: random blogs, snippets without provenance, abandoned packages, unknown forks, outdated tutorials, forum answers, unlicensed code.
- For GitHub sources, prefer repositories owned by the official maintainer.
- Before adding a dependency, verify: need, maintainer, official repo, version, license, maintenance status, known vulnerabilities, backend impact, bundle impact.
- Document structural dependency decisions in an ADR.
