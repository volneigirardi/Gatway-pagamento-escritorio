import { describe, it, expect } from "vitest";
import { randomUuid, randomEmail, wait } from "./index.js";

describe("testing helpers", () => {
  it("generates uuid", () => expect(randomUuid()).toHaveLength(36));
  it("generates email", () => expect(randomEmail()).toContain("@example.com"));
  it("waits", async () => {
    const start = Date.now();
    await wait(10);
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);
  });
});
