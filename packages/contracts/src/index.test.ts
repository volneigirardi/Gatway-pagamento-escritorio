import { describe, it, expect } from "vitest";
import { healthStatusSchema } from "./index.js";

describe("healthStatusSchema", () => {
  it("accepts a valid health status", () => {
    const result = healthStatusSchema.safeParse({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
    });
    expect(result.success).toBe(true);
  });
  it("rejects invalid status", () => {
    const result = healthStatusSchema.safeParse({
      status: "unknown",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
    });
    expect(result.success).toBe(false);
  });
});
