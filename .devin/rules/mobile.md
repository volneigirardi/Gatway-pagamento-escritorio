---
description: "Mobile application implementation rules"
trigger: glob
paths:
  - "apps/mobile/**/*"
  - "packages/ui-native/**/*"
---

# Mobile Rules

- React Native with Expo, New Architecture, Hermes.
- Expo Router for navigation.
- TanStack Query for server state.
- Secure storage for refresh token; access token in memory.
- Use `@saas/ui-native` components; do not force web component reuse.
- Biometric auth optional but not a sole factor.
- Support iOS and Android builds separately.
- Test on emulators and physical devices.
