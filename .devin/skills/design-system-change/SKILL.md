---
name: design-system-change
description: Plan or implement a design system component change
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
  - edit
---

Implement or review a design system change.

1. Read `.devin/rules/design-system.md` and `.devin/rules/accessibility.md`.
2. Check existing components in `packages/ui-web/` or `packages/ui-native/` for patterns.
3. Use design tokens from `@saas/design-tokens`; avoid literal values.
4. Ensure keyboard accessibility and focus management on web.
5. Add or update Storybook stories for web components.
6. Verify responsive behavior and dark mode support.
7. Run visual regression tests if available.
8. Summarize changes and affected consumers.
