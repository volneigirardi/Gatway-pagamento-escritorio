import { z } from "zod";

export const accessTokenClaimsSchema = z.object({
  sub: z.string().uuid(),
  tid: z.string().uuid(),
  roles: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  jti: z.string().uuid(),
  iat: z.number(),
  exp: z.number(),
  nbf: z.number(),
});

export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  tokenId: string;
}
