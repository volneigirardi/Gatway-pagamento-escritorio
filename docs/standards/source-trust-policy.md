# Source Trust Policy

## Allowed Sources

Use these as sources of truth:

- Official project documentation and release notes
- Official source code repositories owned by the maintainer
- Official standards (OWASP, RFCs, ISO, NIST, etc.)
- Official security advisories (GitHub Security Advisories, CVE/NVD/OSV)
- npm registry metadata for package versions, licenses, and maintainers
- Official package changelogs
- PostgreSQL, Node.js, Docker, Kubernetes, Redis, NestJS, React, and other official project docs

## Prohibited as Sole Truth

Do not rely solely on:

- Random blogs or Medium articles
- Unattributed code snippets
- Outdated tutorials
- Forum answers (Stack Overflow, Reddit, etc.)
- Unknown or unlicensed forks
- Repositories impersonating official packages
- Copied code without provenance

## Dependency Approval Process

Before adding or upgrading a structural dependency, document:

1. Why it is needed
2. Official maintainer and repository
3. Exact version and license
4. Maintenance status and age of the release
5. Known vulnerabilities (npm audit, OSV)
6. Backend and bundle impact
7. Alternatives considered
8. Approval record (ADR or issue comment)

## Verdicts

- **Approved** — Can be used.
- **Approved with caveats** — Use only as documented.
- **Rejected** — Do not use; record reason.
