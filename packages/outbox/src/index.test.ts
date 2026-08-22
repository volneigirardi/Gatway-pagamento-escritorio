import { describe, it, expect } from "vitest";
import { outboxEventSchema } from "./index.js";

describe("@saas/outbox", () => {
  it("validates an outbox event schema", () => {
    const event = {
      id: "11111111-1111-4111-8111-111111111111",
      tenantId: "22222222-2222-4222-8222-222222222222",
      aggregateType: "Invoice",
      aggregateId: "33333333-3333-4333-8333-333333333333",
      type: "invoice.created",
      payload: { amount: 100 },
      metadata: {},
      createdAt: new Date().toISOString(),
    };
    expect(outboxEventSchema.parse(event).type).toBe("invoice.created");
  });
});
