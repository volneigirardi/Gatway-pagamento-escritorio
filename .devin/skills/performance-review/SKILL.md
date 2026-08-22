---
name: performance-review
description: Review performance characteristics of changes
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Review changes for performance issues.

1. Check for N+1 queries and inefficient joins.
2. Verify pagination on list endpoints (cursor-based for large collections).
3. Check cache usage, TTL, and invalidation strategy.
4. Check bundle size and lazy loading on web/mobile.
5. Verify connection pooling, timeouts, and retries.
6. Check for unnecessary re-renders or data fetching.
7. Check for event storms or reconnect storms in realtime.
8. Recommend measurements before optimization.
9. Report findings with file paths and line numbers.

Do not modify code unless asked.
