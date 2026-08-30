import { type Kysely, sql } from "kysely";

interface OutboxDatabase {
  outbox: {
    event_type: string;
    event_version: string;
  };
}

export async function up(db: Kysely<OutboxDatabase>): Promise<void> {
  await sql`ALTER TABLE outbox RENAME COLUMN event_type TO type`.execute(db);
  await sql`ALTER TABLE outbox ALTER COLUMN event_version SET DEFAULT 'v1'`.execute(
    db,
  );
}

export async function down(db: Kysely<OutboxDatabase>): Promise<void> {
  await sql`ALTER TABLE outbox ALTER COLUMN event_version DROP DEFAULT`.execute(
    db,
  );
  await sql`ALTER TABLE outbox RENAME COLUMN type TO event_type`.execute(db);
}
