import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";
import { createMemoryStore } from "../src/memory-store.js";
import { parseQaConfig } from "../src/config.js";
import { closeQaDb, createQaDb } from "../src/db.js";
import { runMigrations } from "./migrator.js";

const projectRoot = path.resolve(import.meta.dirname, "../../..");

describe("MemoryStore integration", () => {
  let connectionString: string;
  let container: StartedTestContainer;

  beforeAll(async () => {
    container = await new GenericContainer("pgvector/pgvector:pg18")
      .withEnvironment({
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: "test",
        POSTGRES_DB: "qa_memory_test",
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forListeningPorts())
      .start();

    await new Promise((resolve) => setTimeout(resolve, 3000));

    connectionString = `postgres://postgres:test@${container.getHost()}:${String(container.getMappedPort(5432))}/qa_memory_test`;
    await runMigrations(connectionString);
  }, 120_000);

  afterAll(async () => {
    await container.stop();
  });

  it("remembers a fact and deduplicates by content hash", async () => {
    const config = parseQaConfig({
      changeId: "test-1",
      scope: "smoke",
      environment: "local",
      sourceSha: "a".repeat(40),
      databaseUrl: connectionString,
      projectRoot,
    });
    const db = createQaDb({ connectionString });
    const store = createMemoryStore(config, { connectionString });

    const id1 = await store.rememberFact({
      kind: "semantic",
      title: "Auth uses RS256",
      content: "Access tokens are signed with RS256.",
    });

    const id2 = await store.rememberFact({
      kind: "semantic",
      title: "Auth uses RS256 duplicate",
      content: "Access tokens are signed with RS256.",
    });

    expect(id1).toBe(id2);

    await store.close();
    await closeQaDb(db);
  });

  it("rejects content containing secrets", async () => {
    const config = parseQaConfig({
      changeId: "test-2",
      scope: "smoke",
      environment: "local",
      sourceSha: "b".repeat(40),
      databaseUrl: connectionString,
      projectRoot,
    });
    const store = createMemoryStore(config, { connectionString });

    await expect(
      store.rememberFact({
        kind: "episodic",
        title: "Secret leak",
        content: "api_key=sk_live_1234567890abcdef",
      }),
    ).rejects.toThrow(/Unsafe content for QA memory/iu);

    await store.close();
  });

  it("records a test run and results", async () => {
    const config = parseQaConfig({
      changeId: "test-3",
      scope: "full",
      environment: "homologation",
      sourceSha: "c".repeat(40),
      databaseUrl: connectionString,
      projectRoot,
    });
    const store = createMemoryStore(config, { connectionString });

    const runId = await store.recordTestRun({
      scope: "full",
      environment: "homologation",
      status: "PASS",
      durationMs: 1234,
      results: [
        {
          command: "pnpm lint",
          exitCode: 0,
          status: "PASS",
          durationMs: 500,
        },
      ],
    });

    expect(runId).toBeDefined();
    await store.close();
  });

  it("upserts graph relations and retrieves context", async () => {
    const config = parseQaConfig({
      changeId: "test-4",
      scope: "targeted",
      environment: "local",
      sourceSha: "d".repeat(40),
      databaseUrl: connectionString,
      projectRoot,
    });
    const store = createMemoryStore(config, { connectionString });

    await store.rememberFact({
      kind: "semantic",
      title: "Tenant isolation rule",
      content:
        "Every business query must be filtered by tenant_id and relationships verified within the tenant boundary.",
    });

    await store.upsertGraphRelation({
      sourceType: "Feature",
      sourceName: "tenant-isolation",
      targetType: "Component",
      targetName: "database",
      relationType: "DEPENDS_ON",
    });

    const context = await store.retrieveContext({
      query: "tenant isolation database",
      topK: 5,
    });

    expect(context.memoryItems.length).toBeGreaterThan(0);
    expect(context.relations.length).toBeGreaterThan(0);
    expect(context.tokenEstimate).toBeGreaterThan(0);

    await store.close();
  });

  it("invalidates evidence and fingerprints", async () => {
    const config = parseQaConfig({
      changeId: "test-5",
      scope: "smoke",
      environment: "local",
      sourceSha: "e".repeat(40),
      databaseUrl: connectionString,
      projectRoot,
    });
    const store = createMemoryStore(config, { connectionString });

    const id = await store.recordEvidence({
      title: "E2E smoke report",
      urlOrPath: "https://ci.example.com/e2e/123",
    });

    await store.invalidateEvidence(id);

    const fingerprint = store.computeFingerprint({
      config,
      changedFiles: ["src/auth.ts"],
    });
    await store.recordFingerprint(fingerprint, "PASS", id);
    const valid = await store.isFingerprintValid(fingerprint);
    expect(valid).toBe(true);

    await store.close();
  });

  it("compacts invalidated old memory", async () => {
    const config = parseQaConfig({
      changeId: "test-6",
      scope: "smoke",
      environment: "local",
      sourceSha: "f".repeat(40),
      databaseUrl: connectionString,
      projectRoot,
    });
    const store = createMemoryStore(config, { connectionString });

    await store.rememberFact({
      kind: "learning",
      title: "Old lesson",
      content: "This is an old invalidated lesson.",
      metadata: { invalidated: true },
    });

    const deleted = await store.compactMemory(0);
    expect(deleted).toBeGreaterThanOrEqual(1);

    await store.close();
  });
});
