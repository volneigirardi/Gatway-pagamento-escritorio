import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createRefreshToken,
  hashRefreshToken,
  matchesRefreshTokenHash,
} from "./refresh-token.js";
import { decryptAuthSecret, encryptAuthSecret } from "./secret-encryption.js";

describe("refresh token material", () => {
  it("generates high-entropy tokens and stores only a stable hash", () => {
    const first = createRefreshToken();
    const rotated = createRefreshToken(first.familyId);

    expect(first.token).not.toBe(first.hash);
    expect(hashRefreshToken(first.token)).toBe(first.hash);
    expect(matchesRefreshTokenHash(first.token, first.hash)).toBe(true);
    expect(matchesRefreshTokenHash(rotated.token, first.hash)).toBe(false);
    expect(rotated.familyId).toBe(first.familyId);
    expect(rotated.tokenId).not.toBe(first.tokenId);
  });
});

describe("auth secret encryption", () => {
  it("round-trips AES-256-GCM data", () => {
    const key = randomBytes(32);
    const encrypted = encryptAuthSecret("JBSWY3DPEHPK3PXP", key);

    expect(encrypted).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptAuthSecret(encrypted, key)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("fails closed for tampering or the wrong key", () => {
    const key = randomBytes(32);
    const encrypted = encryptAuthSecret("JBSWY3DPEHPK3PXP", key);
    const [version, iv, tag, ciphertext] = encrypted.split(".");
    if (!version || !iv || !tag || !ciphertext) {
      throw new Error("Invalid encrypted test value");
    }
    const tamperedCiphertext = `${ciphertext.startsWith("A") ? "B" : "A"}${ciphertext.slice(1)}`;
    const tampered = `${version}.${iv}.${tag}.${tamperedCiphertext}`;

    expect(() => decryptAuthSecret(tampered, key)).toThrow();
    expect(() => decryptAuthSecret(encrypted, randomBytes(32))).toThrow();
  });
});
