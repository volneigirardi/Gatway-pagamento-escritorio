# Mobile Performance

## Startup

- Hermes engine enabled.
- Minimize bundle size.
- Defer non-critical initialization.
- Target cold start < 2 s.

## Runtime

- Avoid re-renders with memoization.
- Flat list virtualization for long lists.
- Optimize images.
- Keep JS thread responsive.

## Network

- Batch API calls.
- Use optimistic updates.
- Cache server state with TanStack Query.
- Respect network conditions.

## Metrics

- Frame rate > 55 fps.
- Interaction latency < 100 ms.
- Bundle size tracked in CI.
