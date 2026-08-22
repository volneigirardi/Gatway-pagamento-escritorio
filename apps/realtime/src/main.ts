import "./instrumentation.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "./app.module.js";
import { createLogger } from "@saas/observability";

async function bootstrap(): Promise<void> {
  const logger = createLogger(process.env["LOG_LEVEL"] ?? "info");
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: process.env["TRUSTED_PROXIES"] === "true",
      bodyLimit: 1024 * 1024,
    }),
    { logger: false },
  );
  app.enableShutdownHooks();
  app.useWebSocketAdapter(new IoAdapter(app));

  const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
  for (const signal of signals) {
    process.on(signal, () => {
      logger.info({ signal }, "Shutting down realtime gateway");
      void app.close();
    });
  }

  const port = Number(process.env["PORT"] ?? 3002);
  await app.listen(port, "0.0.0.0");
  logger.info(`Realtime gateway listening on port ${String(port)}`);
}
void bootstrap();
