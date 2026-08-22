import { z } from "zod";

const logLevelSchema = z.enum([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
]);

const baseConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: logLevelSchema.default("info"),
  REQUEST_ID_HEADER: z.string().default("x-request-id"),
  CORRELATION_ID_HEADER: z.string().default("x-correlation-id"),
  TRUSTED_PROXIES: z.string().default(""),
  CORS_ORIGINS: z
    .string()
    .min(1, "CORS_ORIGINS is required; use a comma-separated allowlist"),
});

const databaseConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.coerce.number().int().min(1).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
  DATABASE_TIMEOUT: z.coerce.number().int().min(1000).default(30000),
});

const redisConfigSchema = z.object({
  REDIS_URL: z.string().url(),
  REDIS_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
});

const securityConfigSchema = z.object({
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  JWT_REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .default(604800),
  COOKIE_SECRET: z.string().min(32).optional(),
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(8192).default(19456),
  ARGON2_ITERATIONS: z.coerce.number().int().min(1).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),
});

const realtimeConfigSchema = z.object({
  WS_PING_TIMEOUT_MS: z.coerce.number().int().min(1000).default(20000),
  WS_PING_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
  WS_MAX_HTTP_BUFFER_SIZE: z.coerce.number().int().min(1).default(1_000_000),
});

const workerConfigSchema = z.object({
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(10),
  WORKER_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
});

const rateLimitConfigSchema = z.object({
  RATE_LIMIT_TTL_MS: z.coerce.number().int().min(1000).default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(100),
});

const telemetryConfigSchema = z.object({
  OTEL_ENABLED: z.enum(["true", "false"]).default("false"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

export const appConfigSchema = baseConfigSchema
  .merge(databaseConfigSchema)
  .merge(redisConfigSchema)
  .merge(securityConfigSchema)
  .merge(realtimeConfigSchema)
  .merge(workerConfigSchema)
  .merge(rateLimitConfigSchema)
  .merge(telemetryConfigSchema);

export type AppConfig = z.infer<typeof appConfigSchema>;

export function validateConfig(
  env: Record<string, string | undefined>,
): AppConfig {
  const parsed = appConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Invalid configuration:\n${issues.join("\n")}`);
  }
  return parsed.data;
}
