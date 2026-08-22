import { jwtVerify, SignJWT } from "jose";
import { accessTokenClaimsSchema, type AuthenticatedUser } from "./types.js";

export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedUser | null>;
}

export interface TokenIssuer {
  issue(user: AuthenticatedUser, expiresInSeconds: number): Promise<string>;
}

/**
 * HS256 JWT verifier/issuer backed by a shared secret. Used by the API
 * (via guards) and the realtime gateway (handshake auth) so both trust the
 * same signature — never decode a token payload without verifying it.
 */
export class JoseJwtService implements TokenVerifier, TokenIssuer {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    if (secret.length < 32) {
      throw new Error("JWT secret must be at least 32 bytes long");
    }
    this.key = new TextEncoder().encode(secret);
  }

  async verify(token: string): Promise<AuthenticatedUser | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ["HS256"],
      });
      const claims = accessTokenClaimsSchema.parse(payload);
      return claimsToUser(claims);
    } catch {
      return null;
    }
  }

  async issue(
    user: AuthenticatedUser,
    expiresInSeconds: number,
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      sub: user.userId,
      tid: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
      jti: user.tokenId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setNotBefore(now)
      .setExpirationTime(now + expiresInSeconds)
      .sign(this.key);
  }
}

export function claimsToUser(claims: {
  sub: string;
  tid: string;
  roles: string[];
  permissions: string[];
  jti: string;
}): AuthenticatedUser {
  return {
    userId: claims.sub,
    tenantId: claims.tid,
    roles: claims.roles,
    permissions: claims.permissions,
    tokenId: claims.jti,
  };
}
