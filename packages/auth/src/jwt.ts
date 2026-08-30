import { createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import {
  accessTokenClaimsSchema,
  type AccessTokenClaims,
  type AuthenticatedUser,
} from "./types.js";

export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedUser | null>;
}

export interface TokenIssuer {
  issue(user: AuthenticatedUser, expiresInSeconds: number): Promise<string>;
}

export interface JwtRealmConfig {
  issuer: string;
  platformAudience: string;
  tenantAudience: string;
  keyId?: string;
  clockToleranceSeconds?: number;
}

function normalizePem(pem: string): string {
  return pem.replaceAll("\\n", "\n");
}

export class JoseJwtVerifier implements TokenVerifier {
  private readonly publicKey: KeyObject;

  constructor(
    publicKeyPem: string,
    private readonly config: JwtRealmConfig,
  ) {
    this.publicKey = createPublicKey(normalizePem(publicKeyPem));
  }

  async verify(token: string): Promise<AuthenticatedUser | null> {
    if (token.length === 0 || token.length > 8192) return null;

    try {
      const { payload, protectedHeader } = await jwtVerify(
        token,
        this.publicKey,
        {
          algorithms: ["RS256"],
          issuer: this.config.issuer,
          audience: [this.config.platformAudience, this.config.tenantAudience],
          typ: "JWT",
          clockTolerance: this.config.clockToleranceSeconds ?? 5,
        },
      );
      if (protectedHeader.alg !== "RS256") return null;
      if (this.config.keyId && protectedHeader.kid !== this.config.keyId) {
        return null;
      }
      const claims = accessTokenClaimsSchema.parse(payload);
      const expectedAudience =
        claims.realm === "platform"
          ? this.config.platformAudience
          : this.config.tenantAudience;
      if (claims.aud !== expectedAudience) return null;
      return claimsToUser(claims);
    } catch {
      return null;
    }
  }
}

export class JoseJwtIssuer implements TokenIssuer {
  private readonly privateKey: KeyObject;

  constructor(
    privateKeyPem: string,
    private readonly config: JwtRealmConfig,
  ) {
    this.privateKey = createPrivateKey(normalizePem(privateKeyPem));
  }

  async issue(
    user: AuthenticatedUser,
    expiresInSeconds: number,
  ): Promise<string> {
    if (
      !Number.isInteger(expiresInSeconds) ||
      expiresInSeconds < 60 ||
      expiresInSeconds > 3600
    ) {
      throw new Error(
        "Access token lifetime must be between 60 and 3600 seconds",
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const audience =
      user.realm === "platform"
        ? this.config.platformAudience
        : this.config.tenantAudience;
    const payload =
      user.realm === "platform"
        ? {
            realm: user.realm,
            roles: user.roles,
            permissions: user.permissions,
          }
        : {
            realm: user.realm,
            tid: user.tenantId,
            roles: user.roles,
            permissions: user.permissions,
          };

    return new SignJWT(payload)
      .setProtectedHeader({
        alg: "RS256",
        typ: "JWT",
        ...(this.config.keyId ? { kid: this.config.keyId } : {}),
      })
      .setSubject(user.userId)
      .setJti(user.tokenId)
      .setIssuer(this.config.issuer)
      .setAudience(audience)
      .setIssuedAt(now)
      .setNotBefore(now)
      .setExpirationTime(now + expiresInSeconds)
      .sign(this.privateKey);
  }
}

export function claimsToUser(claims: AccessTokenClaims): AuthenticatedUser {
  const shared = {
    userId: claims.sub,
    roles: claims.roles,
    permissions: claims.permissions,
    tokenId: claims.jti,
  };

  return claims.realm === "platform"
    ? { ...shared, realm: "platform" }
    : { ...shared, realm: "tenant", tenantId: claims.tid };
}
