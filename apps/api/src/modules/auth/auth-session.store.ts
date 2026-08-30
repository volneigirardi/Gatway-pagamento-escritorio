import { Injectable } from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  createRefreshToken,
  hashRefreshToken,
  type RefreshTokenMaterial,
} from "@saas/auth";
import { RedisService } from "../../common/redis.module.js";

const challengeSchema = z
  .object({
    identityId: z.uuid(),
    stage: z.enum(["password_change", "mfa_setup", "mfa_confirm", "mfa"]),
  })
  .strict();

const refreshSessionSchema = z
  .object({
    identityId: z.uuid(),
    tokenId: z.uuid(),
    familyId: z.uuid(),
    csrfHash: z.string().min(43).max(43),
  })
  .strict();

export type AuthChallenge = z.infer<typeof challengeSchema>;
export type RefreshSession = z.infer<typeof refreshSessionSchema>;

export interface RefreshSessionMaterial {
  material: RefreshTokenMaterial;
  csrfToken: string;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function digestMatches(value: string, expected: string): boolean {
  const actualBuffer = Buffer.from(digest(value), "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function parseStored<T>(schema: z.ZodType<T>, value: string): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(value) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

@Injectable()
export class AuthSessionStore {
  constructor(private readonly redis: RedisService) {}

  async createChallenge(
    challenge: AuthChallenge,
    ttlSeconds = 300,
  ): Promise<string> {
    const parsed = challengeSchema.parse(challenge);
    const token = randomBytes(32).toString("base64url");
    await this.redis.client.set(
      `auth:challenge:${digest(token)}`,
      JSON.stringify(parsed),
      "EX",
      ttlSeconds,
    );
    return token;
  }

  async consumeChallenge(token: string): Promise<AuthChallenge | null> {
    if (token.length < 32 || token.length > 512) return null;
    const key = `auth:challenge:${digest(token)}`;
    const value = await this.redis.client.eval(
      "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
      1,
      key,
    );
    if (typeof value !== "string") return null;
    return parseStored(challengeSchema, value);
  }

  async createRefreshSession(
    identityId: string,
    ttlSeconds: number,
    familyId?: string,
  ): Promise<RefreshSessionMaterial> {
    const material = createRefreshToken(familyId);
    const csrfToken = randomBytes(32).toString("base64url");
    await this.storeRefreshSession(
      identityId,
      material,
      digest(csrfToken),
      ttlSeconds,
    );
    return { material, csrfToken };
  }

  async rotateRefreshSession(
    token: string,
    csrfToken: string,
    ttlSeconds: number,
  ): Promise<{
    previous: RefreshSession;
    material: RefreshTokenMaterial;
    csrfToken: string;
  } | null> {
    let tokenHash: string;
    if (csrfToken.length < 32 || csrfToken.length > 512) return null;
    try {
      tokenHash = hashRefreshToken(token);
    } catch {
      return null;
    }
    const csrfHash = digest(csrfToken);

    const value = await this.redis.client.eval(
      `local session = redis.call('GET', KEYS[1])
       if not session then return nil end
       local parsed = cjson.decode(session)
       if parsed.csrfHash ~= ARGV[3] then return '__CSRF_MISMATCH__' end
       redis.call('DEL', KEYS[1])
       redis.call('SREM', 'auth:refresh:family:' .. parsed.familyId, ARGV[1])
       redis.call('SET', 'auth:refresh:used:' .. ARGV[1], parsed.familyId, 'EX', ARGV[2])
       return session`,
      1,
      `auth:refresh:token:${tokenHash}`,
      tokenHash,
      String(ttlSeconds),
      csrfHash,
    );

    if (value === "__CSRF_MISMATCH__") return null;
    if (typeof value !== "string") {
      const reusedFamily = await this.redis.client.get(
        `auth:refresh:used:${tokenHash}`,
      );
      if (reusedFamily) await this.revokeFamily(reusedFamily);
      return null;
    }

    const parsed = parseStored(refreshSessionSchema, value);
    if (!parsed) return null;
    const material = createRefreshToken(parsed.familyId);
    const nextCsrfToken = randomBytes(32).toString("base64url");
    await this.storeRefreshSession(
      parsed.identityId,
      material,
      digest(nextCsrfToken),
      ttlSeconds,
    );
    return {
      previous: parsed,
      material,
      csrfToken: nextCsrfToken,
    };
  }

  async verifyRefreshCsrf(token: string, csrfToken: string): Promise<boolean> {
    if (csrfToken.length < 32 || csrfToken.length > 512) return false;
    let tokenHash: string;
    try {
      tokenHash = hashRefreshToken(token);
    } catch {
      return false;
    }
    const value = await this.redis.client.get(
      `auth:refresh:token:${tokenHash}`,
    );
    if (!value) return false;
    const parsed = parseStored(refreshSessionSchema, value);
    return parsed ? digestMatches(csrfToken, parsed.csrfHash) : false;
  }

  async revokeByToken(token: string): Promise<void> {
    let tokenHash: string;
    try {
      tokenHash = hashRefreshToken(token);
    } catch {
      return;
    }
    const value = await this.redis.client.get(
      `auth:refresh:token:${tokenHash}`,
    );
    if (value) {
      const parsed = parseStored(refreshSessionSchema, value);
      if (parsed) {
        await this.revokeFamily(parsed.familyId);
        return;
      }
    }
    const usedFamily = await this.redis.client.get(
      `auth:refresh:used:${tokenHash}`,
    );
    if (usedFamily) await this.revokeFamily(usedFamily);
  }

  async revokeIdentity(identityId: string): Promise<void> {
    const identityKey = `auth:refresh:identity:${identityId}`;
    const families = await this.redis.client.smembers(identityKey);
    for (const familyId of families) await this.revokeFamily(familyId);
    await this.redis.client.del(identityKey);
  }

  async isLoginBlocked(
    fingerprint: string,
    maximumAttempts: number,
  ): Promise<boolean> {
    const attempts = await this.redis.client.get(
      `auth:login-attempt:${digest(fingerprint)}`,
    );
    return Number(attempts ?? 0) >= maximumAttempts;
  }

  async recordLoginFailure(
    fingerprint: string,
    windowSeconds: number,
  ): Promise<number> {
    const key = `auth:login-attempt:${digest(fingerprint)}`;
    const attempts = await this.redis.client.incr(key);
    if (attempts === 1) await this.redis.client.expire(key, windowSeconds);
    return attempts;
  }

  async clearLoginFailures(fingerprint: string): Promise<void> {
    await this.redis.client.del(`auth:login-attempt:${digest(fingerprint)}`);
  }

  private async storeRefreshSession(
    identityId: string,
    material: RefreshTokenMaterial,
    csrfHash: string,
    ttlSeconds: number,
  ): Promise<void> {
    const session = refreshSessionSchema.parse({
      identityId,
      tokenId: material.tokenId,
      familyId: material.familyId,
      csrfHash,
    });
    const tokenKey = `auth:refresh:token:${material.hash}`;
    const familyKey = `auth:refresh:family:${material.familyId}`;
    const familyMetaKey = `auth:refresh:family-meta:${material.familyId}`;
    const identityKey = `auth:refresh:identity:${identityId}`;
    await this.redis.client
      .multi()
      .set(tokenKey, JSON.stringify(session), "EX", ttlSeconds)
      .sadd(familyKey, material.hash)
      .expire(familyKey, ttlSeconds)
      .set(familyMetaKey, identityId, "EX", ttlSeconds)
      .sadd(identityKey, material.familyId)
      .expire(identityKey, ttlSeconds)
      .exec();
  }

  private async revokeFamily(familyId: string): Promise<void> {
    if (!z.uuid().safeParse(familyId).success) return;
    const familyKey = `auth:refresh:family:${familyId}`;
    const familyMetaKey = `auth:refresh:family-meta:${familyId}`;
    const [hashes, identityId] = await Promise.all([
      this.redis.client.smembers(familyKey),
      this.redis.client.get(familyMetaKey),
    ]);
    const transaction = this.redis.client.multi();
    for (const hash of hashes) transaction.del(`auth:refresh:token:${hash}`);
    transaction.del(familyKey).del(familyMetaKey);
    if (identityId) {
      transaction.srem(`auth:refresh:identity:${identityId}`, familyId);
    }
    await transaction.exec();
  }
}
