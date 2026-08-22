import { describe, it, expect } from "vitest";
import {
  createLogger,
  runWithRequestContext,
  getRequestContext,
} from "./index.js";

describe("observability", () => {
  it("creates a logger", () => {
    const logger = createLogger("info");
    expect(logger).toBeDefined();
  });
  it("stores request context", () => {
    const ctx = { requestId: "req-1", correlationId: "corr-1" };
    runWithRequestContext(ctx, () => {
      expect(getRequestContext()).toEqual(ctx);
    });
  });
});
