import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";

@Injectable()
export class HealthService implements OnModuleDestroy {
  private client?: Redis;

  private getClient(): Redis {
    if (!this.client) {
      const redisUrl = process.env["REDIS_URL"];
      if (!redisUrl) {
        throw new Error("REDIS_URL is required");
      }
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      this.client.on("error", () => {
        // Swallow: readiness check surfaces failures via ping() rejection.
      });
    }
    return this.client;
  }

  isLive(): { status: string } {
    return { status: "ok" };
  }

  async isReady(): Promise<{ status: string; redis: string }> {
    try {
      await this.getClient().ping();
      return { status: "ok", redis: "ok" };
    } catch (err) {
      throw new Error(
        `Redis readiness check failed: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }
}
