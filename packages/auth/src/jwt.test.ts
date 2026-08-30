import { generateKeyPairSync, randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { JoseJwtIssuer, JoseJwtVerifier, type JwtRealmConfig } from "./jwt.js";
import type { AuthenticatedUser } from "./types.js";

const keys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const config: JwtRealmConfig = {
  issuer: "https://app.blupo.com.br",
  platformAudience: "blupo-platform",
  tenantAudience: "blupo-tenant",
  keyId: "test-key-1",
};
const issuer = new JoseJwtIssuer(keys.privateKey, config);
const verifier = new JoseJwtVerifier(keys.publicKey, config);

const platformUser: AuthenticatedUser = {
  realm: "platform",
  userId: "11111111-1111-4111-8111-111111111111",
  roles: ["platform_owner"],
  permissions: ["platform:dashboard:read"],
  tokenId: "33333333-3333-4333-8333-333333333333",
};

const tenantUser: AuthenticatedUser = {
  realm: "tenant",
  userId: "44444444-4444-4444-8444-444444444444",
  tenantId: "22222222-2222-4222-8222-222222222222",
  roles: ["tenant_super_admin"],
  permissions: ["company:read"],
  tokenId: "55555555-5555-4555-8555-555555555555",
};

describe("RS256 access tokens", () => {
  it("issues and verifies isolated platform claims", async () => {
    const escapedIssuer = new JoseJwtIssuer(
      keys.privateKey.replaceAll("\n", "\\n"),
      config,
    );
    const escapedVerifier = new JoseJwtVerifier(
      keys.publicKey.replaceAll("\n", "\\n"),
      config,
    );
    const token = await escapedIssuer.issue(platformUser, 900);
    await expect(escapedVerifier.verify(token)).resolves.toEqual(platformUser);
  });

  it("issues and verifies tenant claims with tid", async () => {
    const token = await issuer.issue(tenantUser, 900);
    await expect(verifier.verify(token)).resolves.toEqual(tenantUser);
  });

  it("rejects a token under the wrong issuer or key ID", async () => {
    const token = await issuer.issue(platformUser, 900);
    const wrongIssuer = new JoseJwtVerifier(keys.publicKey, {
      ...config,
      issuer: "https://invalid.example",
    });
    const wrongKeyId = new JoseJwtVerifier(keys.publicKey, {
      ...config,
      keyId: "different-key",
    });

    await expect(wrongIssuer.verify(token)).resolves.toBeNull();
    await expect(wrongKeyId.verify(token)).resolves.toBeNull();
  });

  it("rejects HS256 and tampered tokens", async () => {
    const now = Math.floor(Date.now() / 1000);
    const hs256 = await new SignJWT({
      realm: "platform",
      roles: ["platform_owner"],
      permissions: ["platform:dashboard:read"],
    })
      .setProtectedHeader({
        alg: "HS256",
        typ: "JWT",
        ...(config.keyId ? { kid: config.keyId } : {}),
      })
      .setSubject(platformUser.userId)
      .setJti(platformUser.tokenId)
      .setIssuer(config.issuer)
      .setAudience(config.platformAudience)
      .setIssuedAt(now)
      .setNotBefore(now)
      .setExpirationTime(now + 900)
      .sign(randomBytes(32));
    const valid = await issuer.issue(platformUser, 900);
    const [header, payload, signature] = valid.split(".");
    if (!header || !payload || !signature)
      throw new Error("Invalid test token");
    const tamperedSignature = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
    const tampered = `${header}.${payload}.${tamperedSignature}`;

    await expect(verifier.verify(hs256)).resolves.toBeNull();
    await expect(verifier.verify(tampered)).resolves.toBeNull();
  });

  it("rejects invalid lifetimes", async () => {
    await expect(issuer.issue(platformUser, 59)).rejects.toThrow();
    await expect(issuer.issue(platformUser, 3601)).rejects.toThrow();
  });
});
