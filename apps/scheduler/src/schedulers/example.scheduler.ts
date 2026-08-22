import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { Queue } from "bullmq";
import { createLogger } from "@saas/observability";
import type { Logger, Level } from "pino";
@Injectable()
export class ExampleScheduler implements OnApplicationShutdown {
  private readonly logger: Logger;
  private readonly queue: Queue;
  constructor() {
    this.logger = createLogger(
      (process.env["LOG_LEVEL"] as Level | undefined) ?? "info",
    ).child({ scheduler: "example" });
    const redisUrl = new URL(
      process.env["REDIS_URL"] ?? "redis://localhost:6379",
    );
    const connection = {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || 6379),
      maxRetriesPerRequest: null as number | null,
    };
    this.queue = new Queue("example", { connection });
    void this.schedule();
  }
  private async schedule(): Promise<void> {
    await this.queue.add(
      "heartbeat",
      { tenantId: "system", payload: "tick" },
      { repeat: { every: 60000 }, jobId: "example:heartbeat" },
    );
    this.logger.info("Scheduled heartbeat job");
  }
  onApplicationShutdown(): Promise<void> {
    this.logger.info("Shutting down scheduler");
    return this.queue.close();
  }
}
