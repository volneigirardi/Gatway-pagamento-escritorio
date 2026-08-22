---
description: "Enforce modular monolith boundaries and dependency direction"
trigger: always_on
---

# Architecture Rules

- This is a modular monolith, not a microservice architecture. Do not extract deployables into separate repositories.
- Backend modules (`apps/api/src/modules/*`) must not depend directly on each other. Use domain events via transactional outbox.
- Allowed shared dependencies: `shared`, `config`, `database`, `observability`, `auth`, `contracts`.
- Layer order: `presentation` → `application` → `domain` → `infrastructure`. Infrastructure must not import application or domain.
- Each module owns its controllers, services, repositories, DTOs, and tests.
- Extract to a microservice only when there is evidence: dedicated team, independent deploy cadence, and resource isolation need. Document in ADR.
