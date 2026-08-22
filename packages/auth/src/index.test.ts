import { describe, it, expect } from "vitest";
import { claimsToUser } from "./index.js";

describe("@saas/auth", () => {
  it("maps claims to user", () => {
    const user = claimsToUser({
      sub: "11111111-1111-1111-1111-111111111111",
      tid: "22222222-2222-2222-2222-222222222222",
      roles: ["admin"],
      permissions: ["users:read"],
      jti: "33333333-3333-3333-3333-333333333333",
    });
    expect(user.userId).toBe("11111111-1111-1111-1111-111111111111");
    expect(user.tenantId).toBe("22222222-2222-2222-2222-222222222222");
  });
});
