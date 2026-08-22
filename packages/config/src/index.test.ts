import { describe, it, expect } from "vitest";
import { validateConfig } from "./index.js";

describe("validateConfig", () => {
  it("validates a minimal valid configuration", () => {
    const config = validateConfig({
      NODE_ENV: "test",
      PORT: "3000",
      LOG_LEVEL: "debug",
      DATABASE_URL: "postgres://localhost/db",
      REDIS_URL: "redis://localhost:6379",
      CORS_ORIGINS: "http://localhost:3004",
      JWT_SECRET: "supersecret-key-32bytes-long-for-tests-only",
    });
    expect(config.PORT).toBe(3000);
    expect(config.LOG_LEVEL).toBe("debug");
  });

  it("throws on invalid configuration", () => {
    expect(() => validateConfig({ NODE_ENV: "invalid" as "test" })).toThrow();
  });
});
