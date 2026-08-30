# Secrets Management

## Rules

- No secrets in code, commits, comments, logs, or tests.
- Secrets injected at runtime via environment variables or a secrets manager.
- Rotate credentials regularly.
- Use least-privilege credentials.

## Categories

| Category    | Examples                                                      | Where                             |
| ----------- | ------------------------------------------------------------- | --------------------------------- |
| Database    | Separate runtime, migration, and provisioning credentials     | Secrets manager or Docker Secrets |
| Cache/Queue | Redis AUTH                                                    | Secrets manager or Docker Secrets |
| Crypto      | RS256 private/public keys, cookie secret, MFA AES-256-GCM key | Secrets manager                   |
| External    | API keys for integrations                                     | Secrets manager                   |
| Storage     | MinIO/S3 keys                                                 | Secrets manager                   |

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

- RS256 signing keys: rotate by key ID with a grace period allowing the previous public key to verify outstanding tokens; private keys are provided only to the API signer.
- Database credentials: rotate runtime, migration, and provisioning roles independently on suspected leak or quarterly.
- MFA encryption key: use versioned ciphertext and controlled re-encryption before retiring an old key.
- API keys: support revocation and rotation.

## Detection

- Pre-commit hook scanning for secrets.
- CI secret scan.
- Regular git history audit.
