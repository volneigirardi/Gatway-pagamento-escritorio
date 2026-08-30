import { describe, expect, it } from "vitest";
import { toSafeInteger } from "./safe-integer.js";

describe("toSafeInteger", () => {
  it("converts safe integer representations", () => {
    expect(toSafeInteger("19900", "amount")).toBe(19900);
    expect(toSafeInteger(42n, "count")).toBe(42);
  });

  it("rejects values outside the JavaScript safe integer range", () => {
    expect(() => toSafeInteger("9007199254740992", "amount")).toThrow(
      "amount exceeds the safe integer range",
    );
  });
});
