import { z } from "zod";

const roleSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9:_-]+$/u);
const permissionSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9:_-]+$/u);

const sharedClaimsSchema = z.object({
  sub: z.string().uuid(),
  roles: z.array(roleSchema).max(32).default([]),
  permissions: z.array(permissionSchema).max(256).default([]),
  jti: z.string().uuid(),
  iss: z.string().min(1).max(256),
  aud: z.string().min(1).max(128),
  iat: z.number().int(),
  exp: z.number().int(),
  nbf: z.number().int(),
});

export const platformAccessTokenClaimsSchema = sharedClaimsSchema
  .extend({
    realm: z.literal("platform"),
  })
  .strict();

export const tenantAccessTokenClaimsSchema = sharedClaimsSchema
  .extend({
    realm: z.literal("tenant"),
    tid: z.string().uuid(),
  })
  .strict();

export const accessTokenClaimsSchema = z.discriminatedUnion("realm", [
  platformAccessTokenClaimsSchema,
  tenantAccessTokenClaimsSchema,
]);

export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

interface AuthenticatedUserBase {
  userId: string;
  roles: string[];
  permissions: string[];
  tokenId: string;
}

export interface PlatformAuthenticatedUser extends AuthenticatedUserBase {
  realm: "platform";
}

export interface TenantAuthenticatedUser extends AuthenticatedUserBase {
  realm: "tenant";
  tenantId: string;
}

export type AuthenticatedUser =
  PlatformAuthenticatedUser | TenantAuthenticatedUser;
