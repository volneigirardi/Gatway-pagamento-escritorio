import "./instrumentation.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "./app.module.js";
import { hydrateFileEnvironment, parseTrustedProxies } from "@saas/config";
import { createLogger } from "@saas/observability";

async function bootstrap(): Promise<void> {
  hydrateFileEnvironment();
  const logger = createLogger(process.env["LOG_LEVEL"] ?? "info");
  const trustedProxies = parseTrustedProxies(process.env["TRUSTED_PROXIES"]);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: trustedProxies.length > 0 ? trustedProxies : false,
      bodyLimit: 1024 * 1024,
    }),
    { logger: false },
  );
  app.enableShutdownHooks();
  app.useWebSocketAdapter(new IoAdapter(app));

  const port = Number(process.env["PORT"] ?? 3002);
  await app.listen(port, "0.0.0.0");
  logger.info(`Realtime gateway listening on port ${String(port)}`);
}
void bootstrap();
