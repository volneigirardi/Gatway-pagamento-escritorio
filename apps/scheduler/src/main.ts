import "./instrumentation.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { SchedulerModule } from "./scheduler.module.js";
import { createLogger } from "@saas/observability";
async function bootstrap(): Promise<void> {
  const logger = createLogger(process.env["LOG_LEVEL"] ?? "info");
  const app = await NestFactory.createApplicationContext(SchedulerModule, {
    logger: false,
  });
  app.enableShutdownHooks();
  logger.info("Scheduler started");
}
void bootstrap();
