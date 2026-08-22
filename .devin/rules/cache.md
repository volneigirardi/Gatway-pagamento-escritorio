---
description: "Caching and distributed state rules"
trigger: model_decision
---

# Cache Rules

- Redis is used for cache, sessions, rate limits, locks, and pub/sub.
- Cache with short TTL. Invalidate explicitly on domain events.
- Do not cache sensitive data without encryption.
- Use cache-aside pattern; avoid write-through for now.
- Rate limiting keys include tenant_id and/or IP.
- Distributed locks (Redlock) for critical operations like conciliation.
- Always set key expiration to prevent leaks.
- Document cache key schemas.
