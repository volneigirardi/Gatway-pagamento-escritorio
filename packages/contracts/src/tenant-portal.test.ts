import { describe, expect, it } from "vitest";
import { updateCompanySettingsRequestSchema } from "./tenant-portal.js";

describe("tenant portal contracts", () => {
  it("accepts supported locale and IANA timezone values", () => {
    expect(
      updateCompanySettingsRequestSchema.safeParse({
        legalName: "Tenant Test Ltda",
        tradeName: "Tenant Test",
        contactEmail: "finance@tenant.test",
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown timezone", () => {
    expect(
      updateCompanySettingsRequestSchema.safeParse({
        legalName: null,
        tradeName: null,
        contactEmail: null,
        timezone: "Mars/Olympus",
        locale: "pt-BR",
      }).success,
    ).toBe(false);
  });
});
