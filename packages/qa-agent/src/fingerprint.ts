import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { QaConfig } from "./config.js";

export interface FingerprintInput {
  config: QaConfig;
  changedFiles?: readonly string[];
  testVersion?: string;
  fixtureHash?: string;
  envFingerprint?: string;
  browser?: string;
}

export interface Fingerprint {
  readonly sourceSha: string;
  readonly lockfileHash: string;
  readonly migrationHash: string;
  readonly configHash: string;
  readonly testVersion: string;
  readonly fixtureHash: string;
  readonly envFingerprint: string;
  readonly browser: string;
  readonly affectedClosure: readonly string[];
  readonly combined: string;
}

function hashFile(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function computeFingerprint(input: FingerprintInput): Fingerprint {
  const { config } = input;
  const root = path.resolve(config.projectRoot);
  const lockfileHash = hashFile(path.join(root, "pnpm-lock.yaml"));
  const migrationHash = hashMigrationDirectory(root);
  const configHash = hashString(
    JSON.stringify({
      scope: config.scope,
      environment: config.environment,
      ragTopK: config.ragTopK,
      ragMaxContextTokens: config.ragMaxContextTokens,
    }),
  );
  const affectedClosure = computeAffectedClosure(
    config.projectRoot,
    config.baseSha,
    config.sourceSha,
    input.changedFiles,
  );

  const combined = createHash("sha256")
    .update(config.sourceSha)
    .update(lockfileHash)
    .update(migrationHash)
    .update(configHash)
    .update(input.testVersion ?? "")
    .update(input.fixtureHash ?? "")
    .update(input.envFingerprint ?? "")
    .update(input.browser ?? "")
    .update(affectedClosure.join(","))
    .digest("hex");

  return {
    sourceSha: config.sourceSha,
    lockfileHash,
    migrationHash,
    configHash,
    testVersion: input.testVersion ?? "unknown",
    fixtureHash: input.fixtureHash ?? "unknown",
    envFingerprint: input.envFingerprint ?? "unknown",
    browser: input.browser ?? "unknown",
    affectedClosure,
    combined,
  };
}

function hashMigrationDirectory(projectRoot: string): string {
  try {
    const output = execSync(
      `git ls-files "${projectRoot}/database/migrations" | xargs sha256sum 2>/dev/null || true`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] },
    );
    return createHash("sha256").update(output).digest("hex");
  } catch {
    return hashString("no-migrations");
  }
}

function computeAffectedClosure(
  root: string,
  baseSha: string | undefined,
  headSha: string,
  changedFiles?: readonly string[],
): readonly string[] {
  if (changedFiles && changedFiles.length > 0) {
    return changedFiles.slice().sort();
  }
  if (!baseSha) {
    return [headSha];
  }
  try {
    const output = execSync(
      `git -C "${root}" diff --name-only "${baseSha}..${headSha}"`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] },
    );
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .sort();
  } catch {
    return [headSha];
  }
}
