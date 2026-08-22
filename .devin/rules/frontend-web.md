---
description: "Web frontend implementation rules"
trigger: glob
paths:
  - "apps/web/**/*"
  - "packages/ui-web/**/*"
---

# Frontend Web Rules

- React 19 functional components with hooks.
- TypeScript strict mode.
- Vite for build and dev server.
- TanStack Router for routing; TanStack Query for server state.
- React Hook Form + Zod for forms.
- Tailwind CSS for styling; Radix primitives for accessible components.
- Use `@saas/ui-web` components; avoid generic shadcn appearance.
- Access token in memory only; refresh via secure cookie.
- WCAG 2.2 AA accessibility target.
- Browser matrix: latest 2 versions of Chrome, Edge, Firefox, Safari, Safari iOS, Chrome Android.
