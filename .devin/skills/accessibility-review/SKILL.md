---
name: accessibility-review
description: Review web changes for accessibility compliance
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Review web changes for accessibility against WCAG 2.2 AA.

1. Check semantic HTML and ARIA usage.
2. Verify all interactive elements are keyboard accessible.
3. Check focus indicators and focus order.
4. Verify labels and error messages for form fields.
5. Check color contrast (4.5:1 normal text, 3:1 large text/UI components).
6. Look for missing alt text, captions, or headings.
7. Report findings with file paths and line numbers.

Do not modify code unless asked.
