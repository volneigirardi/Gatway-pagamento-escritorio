import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setup, teardown } from "./setup-integration.js";
import { createKysely, closeKysely, type Database } from "@saas/database";
import { KyselyOutboxPublisher } from "@saas/outbox";
import type { OutboxDatabase } from "@saas/outbox";
import { sql, type Kysely } from "kysely";

interface IdempotencyKeysTable {
  id: string;
  tenant_id: string;
  scope: string;
  key: string;
  status: string;
  response: unknown;
  expires_at: string;
  created_at: string;
}

type TestDatabase = Database & { idempotency_keys: IdempotencyKeysTable };

describe("idempotency and outbox", () => {
  let db: Kysely<TestDatabase>;

  beforeAll(async () => {
    await setup();
    db = createKysely({ connectionString: process.env.DATABASE_URL! });
    await db.schema
      .createTable("idempotency_keys")
      .addColumn("id", "uuid", (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn("tenant_id", "uuid", (col) => col.notNull())
      .addColumn("scope", "varchar(255)", (col) => col.notNull())
      .addColumn("key", "varchar(255)", (col) => col.notNull())
      .addColumn("status", "varchar(50)", (col) => col.notNull())
      .addColumn("response", "jsonb")
      .addColumn("expires_at", "timestamptz", (col) => col.notNull())
      .addColumn("created_at", "timestamptz", (col) =>
        col.notNull().defaultTo(sql`now()`),
      )
      .execute();
    await db.schema
      .createIndex("uq_idempotency_keys_tenant_scope_key")
      .on("idempotency_keys")
      .columns(["tenant_id", "scope", "key"])
      .unique()
      .execute();
  });

  afterAll(async () => {
    await closeKysely(db);
    await teardown();
  });

  it("prevents duplicate idempotency keys for the same tenant and scope", async () => {
    const tenantId = "11111111-1111-1111-1111-111111111111";
    const scope = "payment";
    const key = "unique-key-123";

    await db
      .insertInto("idempotency_keys")
      .values({
        tenant_id: tenantId,
        scope,
        key,
        status: "completed",
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .execute();

    await expect(
      db
        .insertInto("idempotency_keys")
        .values({
          tenant_id: tenantId,
          scope,
          key,
          status: "pending",
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .execute(),
    ).rejects.toThrow();
  });

  it("publishes an outbox event inside a transaction", async () => {
    await db.schema
      .createTable("outbox")
      .addColumn("id", "uuid", (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn("tenant_id", "uuid", (col) => col.notNull())
      .addColumn("aggregate_type", "varchar(255)", (col) => col.notNull())
      .addColumn("aggregate_id", "varchar(255)", (col) => col.notNull())
      .addColumn("type", "varchar(255)", (col) => col.notNull())
      .addColumn("payload", "jsonb", (col) => col.notNull())
      .addColumn("metadata", "jsonb")
      .addColumn("created_at", "timestamptz", (col) =>
        col.notNull().defaultTo(sql`now()`),
      )
      .addColumn("processed_at", "timestamptz")
      .execute();

    const publisher = new KyselyOutboxPublisher();
    await db.transaction().execute(async (trx) => {
      await publisher.publish(trx as Kysely<OutboxDatabase>, {
        tenantId: "11111111-1111-1111-1111-111111111111",
        aggregateType: "Invoice",
        aggregateId: "aaaaaaaa-1111-1111-1111-111111111111",
        type: "invoice.created",
        payload: { amount: 100 },
      });
    });

    const rows = await db.selectFrom("outbox").selectAll().execute();
    expect(rows.length).toBe(1);
    expect(rows[0].processed_at).toBeNull();
  });
});
