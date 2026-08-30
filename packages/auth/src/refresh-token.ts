import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

export interface RefreshTokenMaterial {
  token: string;
  hash: string;
  tokenId: string;
  familyId: string;
}

export function hashRefreshToken(token: string): string {
  if (token.length < 32 || token.length > 512) {
    throw new Error("Refresh token has an invalid length");
  }
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

export function createRefreshToken(
  familyId: string = randomUUID(),
): RefreshTokenMaterial {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: hashRefreshToken(token),
    tokenId: randomUUID(),
    familyId,
  };
}

export function matchesRefreshTokenHash(
  token: string,
  expectedHash: string,
): boolean {
  try {
    const actual = Buffer.from(hashRefreshToken(token), "base64url");
    const expected = Buffer.from(expectedHash, "base64url");
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
