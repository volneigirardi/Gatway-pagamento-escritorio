---
description: "Accessibility requirements for web"
trigger: glob
paths:
  - "apps/web/**/*"
  - "packages/ui-web/**/*"
---

# Accessibility Rules

- Target WCAG 2.2 AA.
- All interactive elements must be keyboard accessible.
- Use semantic HTML and ARIA only when HTML semantics are insufficient.
- Color contrast minimum 4.5:1 for normal text, 3:1 for large text and UI components.
- Form fields must have associated labels.
- Focus indicators must be visible.
- Automated accessibility checks in CI where possible.
- Test with keyboard and screen reader flows.
