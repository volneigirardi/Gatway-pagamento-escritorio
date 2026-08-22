import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { Worker, Job } from "bullmq";
import { createLogger, type Logger } from "@saas/observability";

interface ExampleJobData {
  tenantId: string;
  payload: string;
}

@Injectable()
export class ExampleWorker implements OnApplicationShutdown {
  private readonly logger: Logger;
  private readonly worker: Worker;
  constructor() {
    this.logger = createLogger(process.env["LOG_LEVEL"] ?? "info").child({
      worker: "example",
    });
    const redisUrl = new URL(
      process.env["REDIS_URL"] ?? "redis://localhost:6379",
    );
    const connection = {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || 6379),
      maxRetriesPerRequest: null as number | null,
    };
    this.worker = new Worker<ExampleJobData>(
      "example",
      async (job) => this.process(job),
      {
        connection,
        concurrency: 10,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    );
    this.worker.on("failed", (job: Job<ExampleJobData> | undefined, err) => {
      const tenantId = job?.data ? job.data.tenantId : undefined;
      this.logger.error(
        {
          jobId: job?.id,
          tenantId,
          error: err instanceof Error ? err.message : String(err),
        },
        "Job failed",
      );
    });
  }
  private async process(job: Job<ExampleJobData>): Promise<void> {
    this.logger.info(
      { jobId: job.id, tenantId: job.data.tenantId },
      "Processing example job",
    );
    await Promise.resolve();
  }
  onApplicationShutdown(): Promise<void> {
    this.logger.info("Shutting down example worker");
    return this.worker.close();
  }
}
