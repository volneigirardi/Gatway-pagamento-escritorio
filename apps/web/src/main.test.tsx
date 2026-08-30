import { describe, expect, it } from "vitest";
import { formatMoney, statusLabel, statusVariant } from "./lib/format.js";

const nonBreakingSpace = "\u00a0";

describe("web presentation helpers", () => {
  it("formats integer cents without losing precision", () => {
    expect(formatMoney(19900).replace(nonBreakingSpace, " ")).toBe("R$ 199,00");
  });

  it("combines text and non-color status information", () => {
    expect(statusLabel("past_due")).toBe("Em atraso");
    expect(statusVariant("past_due")).toBe("destructive");
  });
});
