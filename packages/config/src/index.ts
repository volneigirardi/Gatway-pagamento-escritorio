import { readFileSync } from "node:fs";
import { z } from "zod";

const logLevelSchema = z.enum([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
]);

const processConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]),
  LOG_LEVEL: logLevelSchema.default("info"),
  REQUEST_ID_HEADER: z.string().default("x-request-id"),
  CORRELATION_ID_HEADER: z.string().default("x-correlation-id"),
  TRUSTED_PROXIES: z
    .string()
    .default("")
    .refine((value) => !["true", "*"].includes(value.trim().toLowerCase()), {
      message: "TRUSTED_PROXIES must be an explicit comma-separated allowlist",
    }),
});

const httpConfigSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z
    .string()
    .min(1, "CORS_ORIGINS is required; use a comma-separated allowlist")
    .refine(
      (value) =>
        value.split(",").every((origin) => {
          const candidate = origin.trim();
          if (candidate.length === 0 || candidate === "*") return false;
          try {
            const parsed = new URL(candidate);
            return (
              (parsed.protocol === "https:" || parsed.protocol === "http:") &&
              parsed.origin === candidate
            );
          } catch {
            return false;
          }
        }),
      "CORS_ORIGINS must contain explicit HTTP(S) origins without wildcards",
    ),
});

const databaseConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).default(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(5),
  DATABASE_TIMEOUT: z.coerce.number().int().min(1000).default(30000),
  TENANT_POOL_CACHE_MAX: z.coerce.number().int().min(1).max(100).default(10),
  TENANT_DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(5).default(1),
});

const redisConfigSchema = z.object({
  REDIS_URL: z.string().url(),
  REDIS_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
});

const jwtVerificationConfigSchema = z.object({
  JWT_PUBLIC_KEY: z.string().min(64),
  JWT_ISSUER: z.string().url(),
  JWT_PLATFORM_AUDIENCE: z.string().min(1).default("blupo-platform"),
  JWT_TENANT_AUDIENCE: z.string().min(1).default("blupo-tenant"),
  JWT_KEY_ID: z.string().min(1),
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
});

const authSecurityConfigSchema = z.object({
  JWT_PRIVATE_KEY: z.string().min(64),
  JWT_REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .default(604800),
  COOKIE_SECRET: z.string().min(32),
  MFA_ENCRYPTION_KEY: z
    .string()
    .min(43)
    .max(44)
    .regex(/^(?:[A-Za-z0-9+/]{43}=|[A-Za-z0-9_-]{43})$/u)
    .refine((value) => Buffer.from(value, "base64").byteLength === 32, {
      message: "MFA_ENCRYPTION_KEY must decode to exactly 32 bytes",
    }),
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(8192).default(19456),
  ARGON2_ITERATIONS: z.coerce.number().int().min(1).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),
});

const realtimeTuningConfigSchema = z.object({
  WS_PING_TIMEOUT_MS: z.coerce.number().int().min(1000).default(20000),
  WS_PING_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
  WS_MAX_HTTP_BUFFER_SIZE: z.coerce.number().int().min(1).default(1_000_000),
});

const tenantProvisioningConfigSchema = z.object({
  MIGRATION_DATABASE_URL: z.string().url(),
  TENANT_PROVISIONER_DATABASE_URL: z.string().url(),
});

const workerTuningConfigSchema = z.object({
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(10),
  TENANT_PROVISIONING_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(4)
    .default(2),
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

export const apiConfigSchema = processConfigSchema
  .merge(httpConfigSchema)
  .merge(databaseConfigSchema)
  .merge(redisConfigSchema)
  .merge(jwtVerificationConfigSchema)
  .merge(authSecurityConfigSchema)
  .merge(rateLimitConfigSchema)
  .merge(telemetryConfigSchema);

export const realtimeConfigSchema = processConfigSchema
  .merge(httpConfigSchema)
  .merge(redisConfigSchema)
  .merge(jwtVerificationConfigSchema)
  .merge(realtimeTuningConfigSchema)
  .merge(telemetryConfigSchema);

export const workerConfigSchema = processConfigSchema
  .merge(databaseConfigSchema)
  .merge(redisConfigSchema)
  .merge(tenantProvisioningConfigSchema)
  .merge(workerTuningConfigSchema)
  .merge(telemetryConfigSchema);

export const schedulerConfigSchema = processConfigSchema
  .merge(databaseConfigSchema)
  .merge(redisConfigSchema)
  .merge(telemetryConfigSchema);

export const appConfigSchema = apiConfigSchema;

export type ApiConfig = z.infer<typeof apiConfigSchema>;
export type RealtimeConfig = z.infer<typeof realtimeConfigSchema>;
export type WorkerConfig = z.infer<typeof workerConfigSchema>;
export type SchedulerConfig = z.infer<typeof schedulerConfigSchema>;
export type AppConfig = ApiConfig;

export function parseTrustedProxies(value: string | undefined): string[] {
  const proxies = (value ?? "")
    .split(",")
    .map((proxy) => proxy.trim())
    .filter(Boolean);
  if (proxies.some((proxy) => ["true", "*"].includes(proxy.toLowerCase()))) {
    throw new Error(
      "TRUSTED_PROXIES must be an explicit comma-separated allowlist",
    );
  }
  return proxies;
}

export function hydrateFileEnvironment(
  env: Record<string, string | undefined> = process.env,
): void {
  for (const [fileKey, filePath] of Object.entries(env)) {
    if (!fileKey.endsWith("_FILE") || !filePath) continue;
    const targetKey = fileKey.slice(0, -5);
    if (env[targetKey] !== undefined) continue;
    const value = readFileSync(filePath, "utf8").replace(/[\r\n]+$/u, "");
    if (value.length === 0) {
      throw new Error(`${fileKey} points to an empty secret file`);
    }
    env[targetKey] = value;
  }
}

function parseConfig<T extends z.ZodType>(
  schema: T,
  env: Record<string, string | undefined>,
): z.output<T> {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Invalid configuration:\n${issues.join("\n")}`);
  }
  return parsed.data;
}

export function validateApiConfig(
  env: Record<string, string | undefined>,
): ApiConfig {
  return parseConfig(apiConfigSchema, env);
}

export function validateRealtimeConfig(
  env: Record<string, string | undefined>,
): RealtimeConfig {
  return parseConfig(realtimeConfigSchema, env);
}

export function validateWorkerConfig(
  env: Record<string, string | undefined>,
): WorkerConfig {
  return parseConfig(workerConfigSchema, env);
}

export function validateSchedulerConfig(
  env: Record<string, string | undefined>,
): SchedulerConfig {
  return parseConfig(schedulerConfigSchema, env);
}

export const validateConfig = validateApiConfig;
