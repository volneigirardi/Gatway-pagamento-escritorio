import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { closeKysely, createKysely } from "@saas/database";
import type { ConnectionOptions } from "bullmq";
import type { Kysely } from "kysely";
import type { WorkerAdminDatabase } from "./database.js";

function bullConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  const database = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: database,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

@Injectable()
export class WorkerInfrastructure implements OnApplicationShutdown {
  readonly database: Kysely<WorkerAdminDatabase>;
  readonly queueConnection: ConnectionOptions;

  constructor(config: ConfigService) {
    this.database = createKysely<WorkerAdminDatabase>({
      connectionString: config.getOrThrow<string>("DATABASE_URL"),
      poolMin: 0,
      poolMax: config.get<number>("DATABASE_POOL_MAX") ?? 5,
    });
    this.queueConnection = bullConnection(
      config.getOrThrow<string>("REDIS_URL"),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await closeKysely(this.database);
  }
}
