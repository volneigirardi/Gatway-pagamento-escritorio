import { createHash } from "node:crypto";
import type { ThrottlerStorage } from "@nestjs/throttler";
import { RedisService } from "./redis.module.js";

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const digest = createHash("sha256")
      .update(`${throttlerName}\u0000${key}`)
      .digest("base64url");
    const result = await this.redis.client.eval(
      `local blockedTtl = redis.call('PTTL', KEYS[2])
       if blockedTtl > 0 then
         local current = tonumber(redis.call('GET', KEYS[1]) or '0')
         return {current, redis.call('PTTL', KEYS[1]), 1, blockedTtl}
       end
       local hits = redis.call('INCR', KEYS[1])
       if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
       local hitsTtl = redis.call('PTTL', KEYS[1])
       if hits > tonumber(ARGV[2]) then
         redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
         return {hits, hitsTtl, 1, tonumber(ARGV[3])}
       end
       return {hits, hitsTtl, 0, 0}`,
      2,
      `throttle:hits:${digest}`,
      `throttle:block:${digest}`,
      String(ttl),
      String(limit),
      String(blockDuration > 0 ? blockDuration : ttl),
    );
    if (!Array.isArray(result) || result.length !== 4) {
      throw new Error("Invalid Redis throttler response");
    }
    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] =
      result.map(Number);
    return {
      totalHits: totalHits ?? 0,
      timeToExpire: Math.max(timeToExpire ?? 0, 0),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: Math.max(timeToBlockExpire ?? 0, 0),
    };
  }
}
