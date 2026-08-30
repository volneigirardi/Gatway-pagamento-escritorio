import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import {
  PermissionGuard,
  PlatformAuthGuard,
  TenantAuthGuard,
  type AccessTokenVerifierService,
  type AuthenticatedRequest,
} from "./auth.guard.js";

function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: vi.fn(),
      getNext: vi.fn(),
    }),
    getHandler: vi.fn(),
    getClass: vi.fn(),
    getType: () => "http",
    getArgs: vi.fn(),
    getArgByIndex: vi.fn(),
    switchToRpc: vi.fn(),
    switchToWs: vi.fn(),
  } as unknown as ExecutionContext;
}

describe("authorization guards", () => {
  it("passes explicit platform and tenant realms to the verifier", async () => {
    const authenticate = vi.fn().mockResolvedValue(true);
    const verifier = {
      authenticate,
    } as unknown as AccessTokenVerifierService;
    const context = contextFor({ headers: {} });

    await new PlatformAuthGuard(verifier).canActivate(context);
    await new TenantAuthGuard(verifier).canActivate(context);

    expect(authenticate).toHaveBeenNthCalledWith(1, context, "platform");
    expect(authenticate).toHaveBeenNthCalledWith(2, context, "tenant");
  });

  it("denies a missing platform permission", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(["platform:tenants:write"]),
    } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);
    const context = contextFor({
      authUser: {
        realm: "platform",
        userId: "11111111-1111-4111-8111-111111111111",
        tokenId: "22222222-2222-4222-8222-222222222222",
        roles: ["platform_owner"],
        permissions: ["platform:dashboard:read"],
      },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
