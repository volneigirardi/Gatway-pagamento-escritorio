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

## Implementation

`database/scripts/backup.ts` and `restore.ts` implement AES-256-GCM
encryption with gzip compression:

- File layout: `[12-byte IV][gzip(pg_dump output) ciphertext][16-byte GCM auth tag]`.
- `BACKUP_ENCRYPTION_KEY` (base64, must decode to exactly 32 bytes, e.g.
  `openssl rand -base64 32`) is required by both scripts.
- `restore.ts` decrypts and decompresses the **entire** file in memory and
  verifies the GCM auth tag **before** sending any SQL to `psql`. This is
  deliberate: GCM only verifies its tag once all ciphertext has been
  processed, so streaming decrypted-but-unverified plaintext directly into
  `psql` would let a corrupted or tampered backup partially execute before
  the integrity failure is detected. A tampered backup or wrong key now
  fails closed with zero statements executed — verified manually against a
  disposable PostgreSQL 18.4 container (backup → wrong-key restore attempt
  correctly rejected before touching the target database; correct-key
  restore correctly reproduced the source rows).
- Known limitation: this buffers the whole dump in memory, trading
  streaming-to-disk for a simple, seek-free file format. Revisit with a
  chunked AEAD framing before backing up databases too large to buffer in
  a single process.
- `pg_dump`/`psql` major version must match (or be compatible with) the
  target PostgreSQL server version; mismatched client/server majors fail
  fast with a clear `pg_dump: error: aborting because of server version
  mismatch` message.

## RPO/RTO

- RPO: 1 hour.
- RTO: 4 hours.
