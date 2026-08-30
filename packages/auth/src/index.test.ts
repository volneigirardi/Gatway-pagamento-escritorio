import { describe, expect, it } from "vitest";
import { claimsToUser } from "./index.js";

describe("claimsToUser", () => {
  it("maps platform claims without a tenant", () => {
    const user = claimsToUser({
      realm: "platform",
      sub: "11111111-1111-4111-8111-111111111111",
      roles: ["platform_owner"],
      permissions: ["platform:dashboard:read"],
      jti: "33333333-3333-4333-8333-333333333333",
      iss: "https://app.blupo.com.br",
      aud: "blupo-platform",
      iat: 1,
      nbf: 1,
      exp: 2,
    });

    expect(user).toEqual({
      realm: "platform",
      userId: "11111111-1111-4111-8111-111111111111",
      roles: ["platform_owner"],
      permissions: ["platform:dashboard:read"],
      tokenId: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("maps tenant claims with the signed tenant ID", () => {
    const user = claimsToUser({
      realm: "tenant",
      sub: "11111111-1111-4111-8111-111111111111",
      tid: "22222222-2222-4222-8222-222222222222",
      roles: ["tenant_super_admin"],
      permissions: ["company:read"],
      jti: "33333333-3333-4333-8333-333333333333",
      iss: "https://app.blupo.com.br",
      aud: "blupo-tenant",
      iat: 1,
      nbf: 1,
      exp: 2,
    });

    expect(user.realm).toBe("tenant");
    if (user.realm === "tenant") {
      expect(user.tenantId).toBe("22222222-2222-4222-8222-222222222222");
    }
  });
});
