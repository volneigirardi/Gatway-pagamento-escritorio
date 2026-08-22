# Specifications

This directory contains specifications for non-trivial features.

## When to Write a Spec

- New domain modules.
- New external integrations.
- New realtime event flows.
- Security-sensitive changes.
- Performance-critical flows.
- Changes that affect multiple deployables.

## Template

Use `docs/specs/TEMPLATE.md`.

## Approval

Specs must be approved before implementation when they touch:

- Architecture
- Security
- Database schema
- Multi-tenancy boundaries
- External integrations
- Realtime events
- Deployment/operations
