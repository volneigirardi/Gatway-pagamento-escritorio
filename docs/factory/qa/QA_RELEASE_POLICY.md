# QA Release Policy

> Rules for the QA Gatekeeper's release gate and production attestation.

## Scope

This policy applies to every promotion of a candidate artifact to production for the Integre system.

## Release Gate Owner

The QA Gatekeeper owns the release gate decision. The development agent, CI pipeline, or release manager cannot self-approve.

## Gate States

| State          | Meaning                                                   |
| -------------- | --------------------------------------------------------- |
| `NAO_INICIADA` | Release validation not started                            |
| `EM_EXECUCAO`  | Validation in progress                                    |
| `APROVADA`     | All gates passed with evidence; attestation produced      |
| `BLOQUEADA`    | Defect, risk, missing evidence, or unresolved dependency  |
| `INCONCLUSIVA` | Flakiness, unavailable scanner, or incomplete environment |

## Required Evidence for Release

1. Source SHA of the candidate is exact and matches the built artifact.
2. Full quality gate passed: lint, typecheck, unit tests, integration tests, E2E smoke.
3. Security scans: secret scan, dependency audit, SAST, container scan, license check passed.
4. SBOM generated for every deployable image.
5. Kubernetes/Compose manifests validated.
6. Tenant isolation negative tests passed using two synthetic tenants.
7. No unresolved critical/high findings from specialist subagents (`postgres-dba`, `appsec-reviewer`, etc.).
8. Performance and accessibility budgets met (when harness exists).

## Atestação

The QA Gatekeeper produces a signed/committed attestation file containing:

- Candidate commit SHA.
- Artifact digest (image SHA, package version).
- Scope of validation (`release`).
- Gate results summary.
- List of evidence artifacts and their locations.
- Any accepted risks with rationale and approver.
- QA Gatekeeper identifier and timestamp.

The production pipeline requires this attestation. Without it, promotion fails closed.

## Production Restrictions

- The QA MASTER account is **never** used in production.
- Production smoke tests are synthetic and non-destructive.
- Production validation does not write, delete, or mutate real tenant data.

## Block and Escalation

QA blocks the release when:

- Any required gate fails.
- Evidence is missing or cannot be reproduced.
- Regression is detected.
- Security or performance problem is found.
- Uncertainty remains about tenant isolation, auth, or data integrity.

Blocked releases require a fix from the development agent and an independent retest by QA.
