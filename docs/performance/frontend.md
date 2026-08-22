# Frontend Performance

## Web

- Route-based code splitting with React.lazy.
- Preload critical routes.
- Optimize images (WebP, responsive sizes, lazy loading).
- Bundle size budget: initial JS < 300 kB gzipped.
- CSS: Tailwind v4 with purge-like content detection.
- Service worker for asset caching (future).

## Metrics

- LCP < 2.5 s.
- INP < 200 ms.
- CLS < 0.1.
- TTFB < 200 ms.

## Runtime

- Debounce/throttle expensive events.
- Memoize heavy components.
- Virtualize long lists.
- Avoid layout thrashing.

## Mobile

- Minimize startup time.
- Lazy load screens.
- Reduce bridge calls.
- Profile JS thread and UI thread.
