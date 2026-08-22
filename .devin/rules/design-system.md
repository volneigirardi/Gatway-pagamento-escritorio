---
description: "Design system, tokens, and component catalog rules"
trigger: glob
paths:
  - "packages/design-tokens/**/*"
  - "packages/ui-web/**/*"
  - "packages/ui-native/**/*"
  - "apps/web/**/*"
  - "apps/mobile/**/*"
---

# Design System Rules

## Approved visual direction

The product visual identity is **minimalist, clean, and professional**, inspired by:

- [Chatwoot](https://www.chatwoot.com/) — spacing, muted palette, clear hierarchy.
- [shadcn/ui](https://ui.shadcn.com/) — component structure, accessible primitives, consistent form patterns.

This direction is frozen. New screens and components must follow these rules.

## Design principles

- **Clarity first**: every screen must be understandable at a glance.
- **Minimalism**: remove visual noise. No gradients, no heavy shadows, no decorative flourishes.
- **Consistency**: the same pattern for buttons, inputs, cards, tables, charts, and navigation must be reused everywhere.
- **Professional**: neutral greys, white surfaces, and a trustworthy blue accent.
- **Whitespace**: generous padding and clear separation between sections.

## Color palette

- **Primary**: blue scale (`#eff6ff` to `#172554` in `professional` theme).
- **Neutrals**: grey scale from near-white `#fafafa` to near-black `#0a0a0a`.
- **Background**: white in light mode, near-black in dark mode.
- **Text**: high-contrast dark greys on light surfaces; light greys on dark surfaces.
- **Semantic**: green for success, amber for warning, red for error, sky-blue for info.
- **No arbitrary hex values**: always use tokens from `@saas/design-tokens`. The `professional` theme is the default.

## Typography and iconography

- Use a single type family for both headings and body text.
- Headings are bold, body text is regular, metadata is muted and smaller.
- Icons are simple, line-style, and consistent in weight.

## Buttons

- Primary buttons: solid blue background, white text, subtle rounded corners.
- Secondary/ghost buttons: transparent or light grey background, blue or dark grey text.
- Destructive buttons: red tone, used only for delete/remove actions.
- Buttons always have a clear hover, focus, and active state.
- No 3D, no heavy shadows, no gradient fills.

## Forms and inputs

- Inputs have a light border, rounded corners, and ample padding.
- Focus state uses a blue ring.
- Labels sit above inputs, never inside placeholders.
- Error messages appear below the input with a red tone.

## Cards and surfaces

- Cards have a white or slightly off-white background.
- Borders are light grey and subtle.
- Use soft shadows only for elevated elements such as dropdowns and modals.

## Tables and lists

- Tables have light horizontal rules, no vertical borders.
- Row hover is a subtle grey.
- Text is left-aligned; numbers are right-aligned.
- Empty states are friendly and guide the next action.

## Charts and dashboards

- Charts must be **modern and clean**, like the shadcn/ui examples.
- Use soft area or line charts with the primary blue and muted grey tones.
- Avoid 3D charts, heavy gridlines, and excessive labels.
- Tooltips are minimal, with a light surface and small text.
- Legends and axes use the `text-muted` token.

## Layout and navigation

- Sidebar or top navigation uses the neutral scale with a subtle active state.
- Content is centered and constrained in max-width.
- Mobile uses the same components with adjusted spacing.

## Accessibility

- All interactive elements must be keyboard accessible.
- Focus indicators are visible and use the primary blue.
- Color alone never conveys meaning; pair it with text or icons.
- Respect WCAG 2.2 AA.

## Implementation

- Tokens live in `@saas/design-tokens`; the `professional` theme is the default.
- Web components use Tailwind CSS v4 and Radix primitives.
- Mobile components use the same tokens adapted to React Native.
- Every new `ui-web` component has a Storybook story.
- Do not import literal hex values or arbitrary Tailwind colors.
