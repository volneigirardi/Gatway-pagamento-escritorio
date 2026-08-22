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

## Devin CLI

Run from a terminal (these are `devin` CLI subcommands, not in-chat slash
commands — verified against the Devin CLI reference during the Fase 5
foundation audit):

```bash
# List rules
devin rules list

# List skills
devin skills list

# Show rule/skill directory locations
devin rules paths
devin skills paths
```

There is no `devin hooks` inspection command; review `.devin/hooks.v1.json`
directly to see configured hooks.
