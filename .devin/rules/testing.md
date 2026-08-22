---
description: "Testing strategy and requirements"
trigger: model_decision
---

# Testing Rules

- Write failing tests before fixing bugs when possible.
- Unit tests with Vitest.
- Integration tests with real PostgreSQL/Redis via testcontainers.
- E2E web tests with Playwright.
- Mobile E2E with Detox or Maestro.
- Mandatory negative tests for tenant isolation.
- Mock external APIs; do not hit real third parties in tests.
- Coverage target 70% minimum, but prioritize critical paths over numbers.
- Never disable tests to make CI pass.
