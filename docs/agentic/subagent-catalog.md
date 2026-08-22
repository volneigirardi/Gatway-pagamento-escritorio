# Subagent Catalog

> Custom subagents are experimental. Equivalent skills exist for every subagent as fallback.

| Subagent                       | Role                                             | Model | Allowed Tools          | Notes              |
| ------------------------------ | ------------------------------------------------ | ----- | ---------------------- | ------------------ |
| `architect-reviewer`           | Module boundaries, dependencies, ADR consistency | swe   | read, grep, glob, exec | Read-only reviewer |
| `postgres-dba`                 | Schema, migrations, queries, performance         | swe   | read, grep, glob, exec | Read-only reviewer |
| `appsec-reviewer`              | Security vulnerabilities and compliance          | swe   | read, grep, glob, exec | Read-only reviewer |
| `performance-network-reviewer` | Performance and network efficiency               | swe   | read, grep, glob, exec | Read-only reviewer |
| `socketio-realtime-reviewer`   | Socket.IO realtime correctness                   | swe   | read, grep, glob, exec | Read-only reviewer |
| `frontend-design-reviewer`     | Design system, components, accessibility         | swe   | read, grep, glob, exec | Read-only reviewer |
| `platform-sre-reviewer`        | Docker, Swarm, Kubernetes, ops                   | swe   | read, grep, glob, exec | Read-only reviewer |
| `qa-reliability-reviewer`      | Tests, edge cases, failure scenarios             | swe   | read, grep, glob, exec | Read-only reviewer |

## Usage

Subagents are invoked by the main agent via `run_subagent` with a specific task. They return structured reports classified by severity:

- critical
- high
- medium
- low
- informational

Subagents do not modify code, deploy, access production, or reveal secrets.
