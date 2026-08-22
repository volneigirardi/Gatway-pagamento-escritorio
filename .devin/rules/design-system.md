---
description: "Design system, tokens, and component catalog rules"
trigger: glob
paths:
  - "packages/design-tokens/**/*"
  - "packages/ui-web/**/*"
  - "packages/ui-native/**/*"
---

# Design System Rules

- Design tokens live in `@saas/design-tokens`.
- Tokens are semantic (e.g., `color-primary`, `spacing-md`) not literal hex values in components.
- Components must be accessible and keyboard-navigable on web.
- Use Radix primitives as base for web components.
- Storybook catalogs every `ui-web` component.
- Do not use generic shadcn/ui visual defaults; customize to product identity.
- Respect dark mode and density tokens.
