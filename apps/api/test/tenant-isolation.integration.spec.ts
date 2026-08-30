import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setup, teardown } from "./setup-integration.js";
import { createKysely, closeKysely, type Database } from "@saas/database";
import { sql, type Kysely } from "kysely";

interface NotesTable {
  id: string;
  tenant_id: string;
  content: string;
}

type TestDatabase = Database & { notes: NotesTable };

describe("tenant-scoped application query", () => {
  let db: Kysely<TestDatabase>;

  beforeAll(async () => {
    await setup();
    db = createKysely({ connectionString: process.env.DATABASE_URL! });
    await db.schema
      .createTable("notes")
      .addColumn("id", "uuid", (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn("tenant_id", "uuid", (col) => col.notNull())
      .addColumn("content", "text", (col) => col.notNull())
      .execute();
  });

  afterAll(async () => {
    await closeKysely(db);
    await teardown();
  });

  it("returns only rows matching the explicit tenant predicate", async () => {
    const tenantA = "11111111-1111-1111-1111-111111111111";
    const tenantB = "22222222-2222-2222-2222-222222222222";

    await db
      .insertInto("notes")
      .values({
        id: "aaaaaaaa-1111-1111-1111-111111111111",
        tenant_id: tenantA,
        content: "A",
      })
      .execute();
    await db
      .insertInto("notes")
      .values({
        id: "bbbbbbbb-2222-2222-2222-222222222222",
        tenant_id: tenantB,
        content: "B",
      })
      .execute();

    const rows = await db
      .selectFrom("notes")
      .selectAll()
      .where("tenant_id", "=", tenantA)
      .execute();

    expect(rows.length).toBe(1);
    expect(rows[0].tenant_id).toBe(tenantA);
  });
});
