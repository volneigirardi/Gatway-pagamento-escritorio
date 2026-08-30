import "./instrumentation.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module.js";
import { hydrateFileEnvironment } from "@saas/config";
import { createLogger } from "@saas/observability";
async function bootstrap(): Promise<void> {
  hydrateFileEnvironment();
  const logger = createLogger(process.env["LOG_LEVEL"] ?? "info");
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: false,
  });
  app.enableShutdownHooks();
  logger.info("Worker started");
}
void bootstrap();
