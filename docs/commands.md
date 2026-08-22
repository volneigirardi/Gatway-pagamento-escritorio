# Common Commands

## Development (when available)

```bash
# Install dependencies
pnpm install

# Run API in development
pnpm --filter api dev

# Run worker
pnpm --filter worker dev

# Run scheduler
pnpm --filter scheduler dev

# Run realtime gateway
pnpm --filter realtime dev

# Run web app
pnpm --filter web dev

# Run mobile
pnpm --filter mobile start
```

## Validation

```bash
# Lint
pnpm lint

# Typecheck
pnpm typecheck

# Test
pnpm test

# Build all
pnpm build
```

## Docker

```bash
# Start local infrastructure
pnpm docker:up

# Stop
pnpm docker:down
```

## Devin

```bash
# List rules
/devin/rules list

# List skills
/devin/skills list

# Show hooks
/hooks
```
