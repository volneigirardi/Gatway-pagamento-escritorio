import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  hydrateFileEnvironment,
  parseTrustedProxies,
  validateConfig,
  validateWorkerConfig,
} from "./index.js";

describe("validateConfig", () => {
  it("validates a minimal valid configuration", () => {
    const config = validateConfig({
      NODE_ENV: "test",
      PORT: "3000",
      LOG_LEVEL: "debug",
      DATABASE_URL: "postgres://localhost/db",
      REDIS_URL: "redis://localhost:6379",
      CORS_ORIGINS: "http://localhost:3004",
      JWT_PRIVATE_KEY: "test-private-key-material-".repeat(4),
      JWT_PUBLIC_KEY: "test-public-key-material-".repeat(4),
      JWT_ISSUER: "https://app.blupo.com.br",
      JWT_PLATFORM_AUDIENCE: "blupo-platform",
      JWT_TENANT_AUDIENCE: "blupo-tenant",
      JWT_KEY_ID: "test-key-1",
      COOKIE_SECRET: "test-cookie-secret-at-least-32-characters",
      MFA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
    });
    expect(config.PORT).toBe(3000);
    expect(config.LOG_LEVEL).toBe("debug");
  });

  it("rejects wildcard CORS origins", () => {
    expect(() =>
      validateConfig({
        NODE_ENV: "test",
        DATABASE_URL: "postgres://localhost/db",
        REDIS_URL: "redis://localhost:6379",
        CORS_ORIGINS: "*",
        JWT_PRIVATE_KEY: "test-private-key-material-".repeat(4),
        JWT_PUBLIC_KEY: "test-public-key-material-".repeat(4),
        JWT_ISSUER: "https://app.blupo.com.br",
        COOKIE_SECRET: "test-cookie-secret-at-least-32-characters",
        MFA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
      }),
    ).toThrow("without wildcards");
  });

  it("parses an explicit trusted proxy allowlist and rejects wildcards", () => {
    expect(parseTrustedProxies("loopback, 10.0.0.0/8")).toEqual([
      "loopback",
      "10.0.0.0/8",
    ]);
    expect(() => parseTrustedProxies("true")).toThrow(
      "explicit comma-separated allowlist",
    );
  });

  it("validates worker configuration without HTTP or JWT secrets", () => {
    const config = validateWorkerConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgres://localhost/db",
      MIGRATION_DATABASE_URL: "postgres://localhost/db",
      TENANT_PROVISIONER_DATABASE_URL: "postgres://localhost/db",
      REDIS_URL: "redis://localhost:6379",
    });

    expect(config.WORKER_CONCURRENCY).toBe(10);
  });

  it("hydrates Docker and Swarm file-backed secrets", () => {
    const directory = mkdtempSync(join(tmpdir(), "blupo-config-"));
    const secretPath = join(directory, "database-url");
    writeFileSync(
      secretPath,
      "postgres://runtime:secret@database/app\n",
      "utf8",
    );
    const env: Record<string, string | undefined> = {
      DATABASE_URL_FILE: secretPath,
    };

    try {
      hydrateFileEnvironment(env);
      expect(env["DATABASE_URL"]).toBe(
        "postgres://runtime:secret@database/app",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("throws on invalid configuration", () => {
    expect(() => validateConfig({ NODE_ENV: "invalid" as "test" })).toThrow();
  });
});
