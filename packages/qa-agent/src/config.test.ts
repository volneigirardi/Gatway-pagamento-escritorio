import { describe, expect, it } from "vitest";
import { gitShaSchema, parseQaConfig, qaConfigSchema } from "./config.js";

describe("gitShaSchema", () => {
  it("accepts a full SHA", () => {
    const sha = "a".repeat(40);
    expect(gitShaSchema.parse(sha)).toBe(sha);
  });

  it("rejects a short SHA", () => {
    expect(() => gitShaSchema.parse("abc123")).toThrow();
  });

  it("rejects invalid characters", () => {
    expect(() => gitShaSchema.parse("g".repeat(40))).toThrow();
  });
});

describe("qaConfigSchema", () => {
  it("parses a minimal valid config", () => {
    const input = {
      changeId: "feature-123",
      scope: "smoke",
      sourceSha: "a".repeat(40),
    };
    const config = qaConfigSchema.parse(input);
    expect(config.changeId).toBe("feature-123");
    expect(config.scope).toBe("smoke");
    expect(config.environment).toBe("local");
    expect(config.baseSha).toBeUndefined();
    expect(config.projectRoot).toBe(".");
  });

  it("parses a full config", () => {
    const input = {
      changeId: "feature-123",
      scope: "release",
      environment: "homologation",
      sourceSha: "b".repeat(40),
      baseSha: "c".repeat(40),
      projectRoot: "/workspace",
    };
    const config = qaConfigSchema.parse(input);
    expect(config.scope).toBe("release");
    expect(config.environment).toBe("homologation");
    expect(config.baseSha).toBe("c".repeat(40));
  });

  it("rejects an invalid scope", () => {
    expect(() =>
      qaConfigSchema.parse({
        changeId: "x",
        scope: "fast",
        sourceSha: "a".repeat(40),
      }),
    ).toThrow();
  });

  it("rejects an invalid source SHA", () => {
    expect(() =>
      qaConfigSchema.parse({
        changeId: "x",
        scope: "smoke",
        sourceSha: "short",
      }),
    ).toThrow();
  });
});

describe("parseQaConfig", () => {
  it("returns a valid config", () => {
    const input = {
      changeId: "feature-123",
      scope: "targeted",
      sourceSha: "a".repeat(40),
    };
    const config = parseQaConfig(input);
    expect(config.scope).toBe("targeted");
  });

  it("throws on invalid input", () => {
    expect(() =>
      parseQaConfig({
        changeId: "",
        scope: "smoke",
        sourceSha: "a".repeat(40),
      }),
    ).toThrow(/Invalid QA config/iu);
  });
});
