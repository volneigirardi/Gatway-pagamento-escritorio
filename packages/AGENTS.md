# Packages Rules

- Packages contain shared code, never application business logic.
- Keep packages focused: contracts, auth rules, config, database, observability, testing, design tokens, ui-web, ui-native.
- Prefer pure functions in shared packages for testability.
- Do not import application code from packages.
- Every package must have its own `tsconfig.json` extending the base config.
