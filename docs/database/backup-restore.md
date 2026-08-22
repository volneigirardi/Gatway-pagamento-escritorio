# Backup and Restore

## Backup Strategy

| Type              | Frequency  | Retention | Tool                       |
| ----------------- | ---------- | --------- | -------------------------- |
| Full logical      | Daily      | 30 days   | pg_dump                    |
| WAL archiving     | Continuous | 7 days    | pg_basebackup/wal-g        |
| Cross-region copy | Daily      | 30 days   | Object storage replication |

## Encryption

- Backups encrypted at rest (AES-256).
- Encryption keys managed by secrets manager.
- Separate keys per tenant for restricted data.

## Restore Procedures

1. Provision target database.
2. Decrypt and verify backup checksum.
3. Restore logical backup.
4. Replay WAL to target point in time.
5. Run smoke tests.
6. Verify data integrity.

## Testing

- A backup is not valid until restore is tested.
- Monthly restore drill to staging.
- Document RPO/RTO targets.

## RPO/RTO

- RPO: 1 hour.
- RTO: 4 hours.
