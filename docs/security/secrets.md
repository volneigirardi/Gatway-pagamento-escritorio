# Secrets Management

## Rules

- No secrets in code, commits, comments, logs, or tests.
- Secrets injected at runtime via environment variables or a secrets manager.
- Rotate credentials regularly.
- Use least-privilege credentials.

## Categories

| Category    | Examples                       | Where                             |
| ----------- | ------------------------------ | --------------------------------- |
| Database    | PostgreSQL passwords           | Secrets manager or Docker Secrets |
| Cache/Queue | Redis AUTH                     | Secrets manager or Docker Secrets |
| Crypto      | JWT signing keys, AES-GCM keys | Secrets manager                   |
| External    | API keys for integrations      | Secrets manager                   |
| Storage     | MinIO/S3 keys                  | Secrets manager                   |

## Development

- Use `.env` file generated from `.env.example`.
- Generate random passwords for local development.
- Never commit `.env`.

## Production

- Prefer cloud secrets manager (AWS Secrets Manager, Azure Key Vault, GCP Secret Manager).
- Kubernetes: External Secrets Operator or Sealed Secrets.
- Docker Swarm: Docker Secrets.
- Mount secrets as files, not environment variables when possible.

## Rotation

- JWT signing keys: rotate with grace period allowing old key verification.
- Database credentials: rotate on suspected leak or quarterly.
- API keys: support revocation and rotation.

## Detection

- Pre-commit hook scanning for secrets.
- CI secret scan.
- Regular git history audit.
