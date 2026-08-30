import "./instrumentation.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { VersioningType } from "@nestjs/common";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
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
  const cookieSecret = process.env["COOKIE_SECRET"];
  if (!cookieSecret) throw new Error("COOKIE_SECRET is required");
  await app.register(cookie, { secret: cookieSecret, hook: "onRequest" });
  app.setGlobalPrefix("/api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  });
  await app.register(compress);

  const corsOrigins = (process.env["CORS_ORIGINS"] ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (corsOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "x-correlation-id",
      "idempotency-key",
      "x-csrf-token",
    ],
  });

  if (process.env["NODE_ENV"] !== "production") {
    const swagger = new DocumentBuilder()
      .setTitle("SaaS Enterprise API")
      .setVersion("1.0.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup("/api/docs", app, document);
  }

  const port = Number(process.env["PORT"] ?? 3000);
  await app.listen(port, "0.0.0.0");
  logger.info(`API listening on port ${String(port)}`);
}
void bootstrap();
