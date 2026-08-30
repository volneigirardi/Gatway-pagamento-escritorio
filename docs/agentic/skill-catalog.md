# Skill Catalog

> Verified during the Fase 5 foundation audit (2026-08-23): all 24 skills
> are discoverable via `skill search` (the `skill list` command reported 0
> results for the same directory — a tool-level discrepancy, not a repo
> defect; noted for awareness, not treated as a finding requiring a fix
> here).

| Skill                     | Purpose                                            | Trigger    | Allowed Tools                | Notes                                             |
| ------------------------- | -------------------------------------------------- | ---------- | ---------------------------- | ------------------------------------------------- |
| `project-resume`          | Summarize current project state                    | user/model | read                         | Read-only                                         |
| `project-status`          | Show repo status vs last known state               | user/model | read, exec, grep             | Read-only                                         |
| `new-feature`             | Plan a new feature before implementation           | user/model | read, grep, glob, exec       | Requires approval                                 |
| `bugfix`                  | Follow debugging protocol                          | user/model | all core                     | 3-hypothesis stop rule                            |
| `incident-debug`          | Triage an incident                                 | user/model | read, grep, glob, exec       | No production actions                             |
| `database-change`         | Plan and review a DB change                        | user/model | read, grep, glob, exec       | Requires final `postgres-dba`; no prod migrations |
| `database-review`         | Review PostgreSQL correctness/security/performance | user/model | read, grep, glob, exec       | Supplements mandatory `postgres-dba` gate         |
| `external-integration`    | Plan an external integration                       | user/model | read, grep, glob, exec       | Requires approval                                 |
| `webhook-implementation`  | Implement/review webhooks                          | user/model | read, grep, glob, exec, edit |                                                   |
| `realtime-change`         | Implement a realtime change                        | user/model | read, grep, glob, exec, edit |                                                   |
| `realtime-review`         | Review Socket.IO changes                           | user/model | read, grep, glob, exec       | Read-only                                         |
| `security-review`         | Review security issues                             | user/model | read, grep, glob, exec       | Read-only                                         |
| `tenant-isolation-review` | Verify tenant isolation                            | user/model | read, grep, glob, exec       | Read-only                                         |
| `performance-review`      | Review performance                                 | user/model | read, grep, glob, exec       | Read-only                                         |
| `network-review`          | Review networking/infra                            | user/model | read, grep, glob, exec       | Read-only                                         |
| `design-system-change`    | Plan/implement design system change                | user/model | read, grep, glob, exec, edit |                                                   |
| `accessibility-review`    | Review accessibility                               | user/model | read, grep, glob, exec       | Read-only                                         |
| `dependency-evaluation`   | Evaluate new dependency                            | user/model | read, exec                   | Requires approval                                 |
| `dependency-upgrade`      | Plan dependency upgrade                            | user/model | read, grep, glob, exec       | Requires approval                                 |
| `architecture-review`     | Review architectural consistency                   | user/model | read, grep, glob, exec       | Read-only                                         |
| `pre-commit`              | Run checks before commit                           | user/model | read, exec                   |                                                   |
| `quality-gate`            | Run full quality gate                              | user/model | read, grep, glob, exec       |                                                   |
| `pre-release`             | Pre-release checklist                              | user       | read, exec                   | Requires approval                                 |
| `session-handoff`         | Update project memory for next session             | user/model | read, exec                   |                                                   |
