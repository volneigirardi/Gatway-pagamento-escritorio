import { Injectable } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { sql } from "kysely";
import { AdminDatabaseService } from "../common/database.module.js";
import { RedisService } from "../common/redis.module.js";

@Injectable()
export class HealthService {
  constructor(
    private readonly database: AdminDatabaseService,
    private readonly redis: RedisService,
  ) {}

  isHealthy(): { status: string } {
    return { status: "ok" };
  }

  async checkDatabase(): Promise<HealthIndicatorResult> {
    await sql`select 1`.execute(this.database.db);
    return { postgresql: { status: "up" } };
  }

  async checkRedis(): Promise<HealthIndicatorResult> {
    await this.redis.client.ping();
    return { redis: { status: "up" } };
  }
}
