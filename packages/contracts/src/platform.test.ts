import { describe, expect, it } from "vitest";
import {
  createPlanRequestSchema,
  createTenantRequestSchema,
} from "./platform.js";

describe("platform contracts", () => {
  it("accepts semantic plan features and integer BRL pricing", () => {
    expect(
      createPlanRequestSchema.safeParse({
        name: "Professional",
        slug: "professional",
        trialDays: 14,
        price: {
          currency: "BRL",
          billingInterval: "monthly",
          amountCents: 19900,
        },
        features: { "users.max": 25, audit: true },
      }).success,
    ).toBe(true);
  });

  it("rejects unsafe slugs and invalid CNPJ values", () => {
    const base = {
      name: "Tenant A",
      slug: "tenant-a",
      contactEmail: "admin@tenant.test",
      planId: "10000000-0000-4000-8000-000000000001",
      planPriceId: "10000000-0000-4000-8000-000000000002",
    };
    expect(
      createTenantRequestSchema.safeParse({
        ...base,
        slug: "x');drop-table--",
      }).success,
    ).toBe(false);
    expect(
      createTenantRequestSchema.safeParse({
        ...base,
        taxId: "12345678000199",
      }).success,
    ).toBe(false);
    expect(
      createTenantRequestSchema.safeParse({
        ...base,
        taxId: "12345678000195",
      }).success,
    ).toBe(true);
  });
});
