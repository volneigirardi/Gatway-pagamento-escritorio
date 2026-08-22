import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setup, teardown } from "./setup-integration.js";
import {
  createKysely,
  closeKysely,
  type Database,
  withTransaction,
} from "@saas/database";
import { sql, type Kysely } from "kysely";

interface CountersTable {
  id: string;
  tenant_id: string;
  value: number;
}

type TestDatabase = Database & { counters: CountersTable };

describe("concurrency", () => {
  let db: Kysely<TestDatabase>;

  beforeAll(async () => {
    await setup();
    db = createKysely({ connectionString: process.env.DATABASE_URL! });
    await db.schema
      .createTable("counters")
      .addColumn("id", "uuid", (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn("tenant_id", "uuid", (col) => col.notNull())
      .addColumn("value", "integer", (col) => col.notNull().defaultTo(0))
      .execute();
  });

  afterAll(async () => {
    await closeKysely(db);
    await teardown();
  });

  it("handles concurrent increments inside transactions", async () => {
    const tenantId = "11111111-1111-1111-1111-111111111111";
    await db
      .insertInto("counters")
      .values({
        id: "aaaaaaaa-1111-1111-1111-111111111111",
        tenant_id: tenantId,
        value: 0,
      })
      .execute();

    const increments = Array.from({ length: 10 }, () =>
      withTransaction(db, async (trx) => {
        const row = await trx
          .selectFrom("counters")
          .select("value")
          .where("id", "=", "aaaaaaaa-1111-1111-1111-111111111111")
          .where("tenant_id", "=", tenantId)
          .forUpdate()
          .executeTakeFirstOrThrow();
        await trx
          .updateTable("counters")
          .set("value", Number(row.value) + 1)
          .where("id", "=", "aaaaaaaa-1111-1111-1111-111111111111")
          .execute();
      }),
    );

    await Promise.all(increments);

    const row = await db
      .selectFrom("counters")
      .select("value")
      .where("id", "=", "aaaaaaaa-1111-1111-1111-111111111111")
      .executeTakeFirstOrThrow();

    expect(row.value).toBe(10);
  });
});
