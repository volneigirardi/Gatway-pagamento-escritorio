import {
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import { Queue } from "bullmq";
import { z } from "zod";
import { createLogger, type Logger } from "@saas/observability";
import { WorkerInfrastructure } from "../infrastructure.js";

const provisioningEventSchema = z
  .object({
    tenantId: z.uuid(),
    identityId: z.uuid().optional(),
  })
  .strict();

export type TenantProvisioningJob = z.infer<typeof provisioningEventSchema>;

@Injectable()
export class PlatformOutboxRelay
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger: Logger;
  private readonly queue: Queue<
    TenantProvisioningJob,
    void,
    string,
    TenantProvisioningJob,
    void,
    string
  >;
  private timer?: NodeJS.Timeout;
  private polling = false;

  constructor(private readonly infrastructure: WorkerInfrastructure) {
    this.logger = createLogger(process.env["LOG_LEVEL"] ?? "info").child({
      worker: "platform-outbox-relay",
    });
    this.queue = new Queue<
      TenantProvisioningJob,
      void,
      string,
      TenantProvisioningJob,
      void,
      string
    >("tenant-provisioning", {
      connection: infrastructure.queueConnection,
    });
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.poll();
    }, 1000);
    void this.poll();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.queue.close();
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      await this.infrastructure.database
        .transaction()
        .execute(async (transaction) => {
          const events = await transaction
            .selectFrom("platform_outbox")
            .selectAll()
            .where("processed_at", "is", null)
            .where("event_type", "in", [
              "tenant.provisioning.requested",
              "tenant.admin.provisioning.requested",
            ])
            .orderBy("created_at", "asc")
            .forUpdate()
            .skipLocked()
            .limit(10)
            .execute();

          for (const event of events) {
            const parsed = provisioningEventSchema.safeParse(event.payload);
            if (!parsed.success) {
              await transaction
                .updateTable("platform_outbox")
                .set({
                  attempts: event.attempts + 1,
                  processed_at: new Date(),
                })
                .where("id", "=", event.id)
                .execute();
              this.logger.error(
                { eventId: event.id, eventType: event.event_type },
                "Invalid provisioning outbox payload",
              );
              continue;
            }
            const jobId = `${event.event_type.replaceAll(".", "-")}-${event.id}`;
            await this.queue.add(event.event_type, parsed.data, {
              jobId,
              attempts: 5,
              backoff: { type: "exponential", delay: 1000 },
              removeOnComplete: { count: 500 },
              removeOnFail: { count: 500 },
            });
            await transaction
              .updateTable("platform_outbox")
              .set({ processed_at: new Date() })
              .where("id", "=", event.id)
              .execute();
          }
        });
    } catch (error) {
      this.logger.error(
        { errorType: error instanceof Error ? error.name : "UnknownError" },
        "Platform outbox relay poll failed",
      );
    } finally {
      this.polling = false;
    }
  }
}
