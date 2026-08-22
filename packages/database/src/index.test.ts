import { describe, it, expect } from "vitest";
import { createKysely, closeKysely } from "./index.js";

describe("database factory", () => {
  it("creates and closes a Kysely instance", async () => {
    const db = createKysely({
      connectionString: "postgres://localhost:5432/test",
    });
    expect(db).toBeDefined();
    await closeKysely(db);
  });
});
