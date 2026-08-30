import { describe, expect, it } from "vitest";
import { invoiceSchema, recordPaymentRequestSchema } from "./billing.js";

describe("billing contracts", () => {
  it("accepts a persisted invoice with integer cents", () => {
    expect(
      invoiceSchema.safeParse({
        id: "10000000-0000-4000-8000-000000000001",
        tenantId: "10000000-0000-4000-8000-000000000002",
        subscriptionId: "10000000-0000-4000-8000-000000000003",
        number: "BLP-2026-0001",
        status: "open",
        currency: "BRL",
        subtotalCents: 19900,
        discountCents: 0,
        taxCents: 0,
        totalCents: 19900,
        dueDate: "2026-09-10",
        issuedAt: "2026-08-24T12:00:00.000Z",
        paidAt: null,
        voidedAt: null,
        createdAt: "2026-08-24T12:00:00.000Z",
        updatedAt: "2026-08-24T12:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("requires a sanitized failure code for failed payments", () => {
    expect(
      recordPaymentRequestSchema.safeParse({
        tenantId: "10000000-0000-4000-8000-000000000002",
        invoiceId: "10000000-0000-4000-8000-000000000001",
        method: "manual",
        status: "failed",
        amountCents: 19900,
      }).success,
    ).toBe(false);
  });
});
