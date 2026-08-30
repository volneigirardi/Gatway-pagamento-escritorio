# QA Evidence Policy

> Rules for collecting, storing, and retaining QA evidence.

## Principles

1. Evidence must be reproducible from committed commands and configuration.
2. Evidence must never contain secrets, credentials, tokens, passwords, or private keys.
3. Evidence is append-only; failures cannot be rewritten or hidden.
4. Evidence links back to the exact source SHA and change ID under test.

## Required Evidence per Gate

| Gate                | Evidence                                                                           |
| ------------------- | ---------------------------------------------------------------------------------- |
| Lint                | Command, exit code, output summary                                                 |
| Typecheck           | Command, exit code, project count                                                  |
| Unit tests          | Command, exit code, files/tests count, failures                                    |
| Integration tests   | Command, exit code, container/runtime versions, failures                           |
| E2E tests           | Command, exit code, browser projects, failures, Playwright report/trace on failure |
| Build               | Command, exit code, output artifacts, size warnings                                |
| Security scans      | Tool output, severity counts, fixed/accepted findings                              |
| Container scans     | Image digest, Trivy output, SBOM file                                              |
| Manifest validation | `kubectl kustomize` / `docker compose config` output                               |
| Tenant isolation    | Two-tenant negative test output and direct SQL attempts                            |
| Performance         | Load-test output, latency distribution, budget comparison                          |
| Accessibility       | axe-core / Lighthouse output, violations count                                     |

## Storage

- Text summaries and structured state are committed under `docs/factory/qa/`.
- Large artifacts (traces, videos, SBOMs, scan JSON) are stored in object storage (MinIO/S3) or CI artifacts, referenced by URL/digest, not committed.
- Sensitive QA environment variables come from Devin/CI Secrets; never from files in the repository.

## Retention

- Keep evidence for the lifetime of the release plus one cycle, or as required by compliance.
- Archive evidence before deleting old CI artifacts.

## Prohibited

- Editing evidence files to change a failure into a pass.
- Omitting failing evidence because a gate is "not important this time".
- Storing credentials in screenshots, videos, logs, or reports.
