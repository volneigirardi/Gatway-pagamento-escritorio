import { randomUUID, createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";
import type { QaConfig } from "./config.js";
import { closeQaDb, createQaDb, type QaDbConfig } from "./db.js";
import type { QaDatabase } from "./db-schema.js";
import {
  type Fingerprint,
  type FingerprintInput,
  computeFingerprint,
} from "./fingerprint.js";
import { assertSafeForMemory } from "./sanitize.js";

export interface RememberFactInput {
  kind:
    | "policy"
    | "semantic"
    | "procedural"
    | "episodic"
    | "learning"
    | "handoff";
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RecordTestRunInput {
  scope: string;
  environment: string;
  status: string;
  durationMs: number;
  results: readonly RecordTestResultInput[];
  metadata?: Record<string, unknown>;
}

export interface RecordTestResultInput {
  command: string;
  exitCode: number;
  status: string;
  durationMs: number;
  output?: string | undefined;
  error?: string | undefined;
}

export interface RecordEvidenceInput {
  title: string;
  urlOrPath: string;
  metadata?: Record<string, unknown>;
}

export interface UpsertGraphRelationInput {
  sourceType: string;
  sourceName: string;
  targetType: string;
  targetName: string;
  relationType: string;
  confidence?: number;
  inferred?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RetrieveContextInput {
  query: string;
  filters?: {
    kinds?: readonly string[];
    sourceSha?: string;
    scope?: string;
    environment?: string;
  };
  topK?: number;
  maxTokens?: number;
}

export interface QaContextPack {
  readonly memoryItems: readonly QaMemoryItemView[];
  readonly entities: readonly QaEntityView[];
  readonly relations: readonly QaRelationView[];
  readonly tokenEstimate: number;
  readonly sources: readonly string[];
}

export interface QaMemoryItemView {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly content: string | null;
  readonly sourceSha: string | null;
  readonly createdAt: Date;
}

export interface QaEntityView {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
}

export interface QaRelationView {
  readonly sourceType: string;
  readonly sourceName: string;
  readonly relationType: string;
  readonly targetType: string;
  readonly targetName: string;
  readonly confidence: number;
}

export interface MemoryStore {
  readonly rememberFact: (input: RememberFactInput) => Promise<string>;
  readonly recordTestRun: (input: RecordTestRunInput) => Promise<string>;
  readonly recordEvidence: (input: RecordEvidenceInput) => Promise<string>;
  readonly upsertGraphRelation: (
    input: UpsertGraphRelationInput,
  ) => Promise<void>;
  readonly retrieveContext: (input: RetrieveContextInput) => Promise<QaContextPack>;
  readonly invalidateEvidence: (memoryItemId: string) => Promise<void>;
  readonly compactMemory: (maxAgeDays?: number) => Promise<number>;
  readonly explainWhyTestWasSelected: (
    command: string,
    changeId: string,
  ) => Promise<string>;
  readonly computeFingerprint: (input: FingerprintInput) => Fingerprint;
  readonly recordFingerprint: (
    fingerprint: Fingerprint,
    resultStatus: string,
    resultId?: string,
  ) => Promise<void>;
  readonly isFingerprintValid: (fingerprint: Fingerprint) => Promise<boolean>;
  readonly close: () => Promise<void>;
}

export function createMemoryStore(
  config: QaConfig,
  dbConfig: QaDbConfig,
): MemoryStore {
  const db = createQaDb(dbConfig);

  async function audit(
    qaDb: Kysely<QaDatabase>,
    operation: string,
    tableName: keyof QaDatabase,
    recordId: string | undefined,
    changeSummary: Record<string, unknown> | undefined,
  ): Promise<void> {
    await qaDb
      .insertInto("qa_.audit_log")
      .values({
        id: randomUUID(),
        operation,
        table_name: tableName,
        record_id: recordId,
        actor: config.changeId,
        change_summary: changeSummary ?? null,
      })
      .execute();
  }

  async function rememberFact(input: RememberFactInput): Promise<string> {
    const safeTitle = assertSafeForMemory(input.title);
    const safeContent = assertSafeForMemory(input.content);
    const contentHash = createHash("sha256")
      .update(safeContent)
      .digest("hex");

    return await db.transaction().execute(async (trx) => {
      const row = await trx
        .insertInto("qa_.memory_items")
        .values({
          id: randomUUID(),
          kind: input.kind,
          change_id: config.changeId,
          source_sha: config.sourceSha,
          scope: config.scope,
          environment: config.environment,
          title: safeTitle,
          content: safeContent,
          content_hash: contentHash,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict((oc) =>
          oc.columns(["content_hash", "kind"]).doUpdateSet({
            updated_at: new Date(),
            source_sha: config.sourceSha,
            metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          }),
        )
        .returning("id")
        .executeTakeFirstOrThrow();

      await audit(trx, "UPSERT", "qa_.memory_items", row.id, {
        kind: input.kind,
      });
      return row.id;
    });
  }

  async function recordTestRun(input: RecordTestRunInput): Promise<string> {
    const id = randomUUID();
    const results = input.results.map((result) => ({
      id: randomUUID(),
      test_run_id: id,
      command: assertSafeForMemory(result.command),
      exit_code: result.exitCode,
      status: result.status,
      duration_ms: result.durationMs,
      output: result.output ? assertSafeForMemory(result.output) : null,
      error: result.error ? assertSafeForMemory(result.error) : null,
      metadata: null,
      created_at: new Date(),
    }));

    return await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("qa_.test_runs")
        .values({
          id,
          change_id: config.changeId,
          source_sha: config.sourceSha,
          base_sha: config.baseSha,
          scope: input.scope,
          environment: input.environment,
          status: input.status,
          duration_ms: input.durationMs,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          created_at: new Date(),
        })
        .execute();

      if (results.length > 0) {
        await trx.insertInto("qa_.test_results").values(results).execute();
      }

      await audit(trx, "INSERT", "qa_.test_runs", id, { status: input.status });
      return id;
    });
  }

  async function recordEvidence(input: RecordEvidenceInput): Promise<string> {
    return rememberFact({
      kind: "episodic",
      title: input.title,
      content: `Evidence: ${input.title}\nLocation: ${input.urlOrPath}`,
      metadata: { type: "evidence", ...input.metadata },
    });
  }

  async function upsertGraphRelation(
    input: UpsertGraphRelationInput,
  ): Promise<void> {
    const sourceSlug = `${input.sourceType}:${input.sourceName}`;
    const targetSlug = `${input.targetType}:${input.targetName}`;

    const source = await db
      .insertInto("qa_.entities")
      .values({
        id: randomUUID(),
        type: input.sourceType,
        name: input.sourceName,
        slug: sourceSlug,
        source_sha: config.sourceSha,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict((oc) => oc.column("slug").doNothing())
      .returning("id")
      .executeTakeFirst();

    const target = await db
      .insertInto("qa_.entities")
      .values({
        id: randomUUID(),
        type: input.targetType,
        name: input.targetName,
        slug: targetSlug,
        source_sha: config.sourceSha,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict((oc) => oc.column("slug").doNothing())
      .returning("id")
      .executeTakeFirst();

    const sourceEntity =
      source ??
      (await db
        .selectFrom("qa_.entities")
        .select("id")
        .where("slug", "=", sourceSlug)
        .executeTakeFirst());
    const targetEntity =
      target ??
      (await db
        .selectFrom("qa_.entities")
        .select("id")
        .where("slug", "=", targetSlug)
        .executeTakeFirst());

    if (!sourceEntity || !targetEntity) {
      throw new Error("Could not resolve graph nodes for relation");
    }

    await db
      .insertInto("qa_.relations")
      .values({
        id: randomUUID(),
        source_id: sourceEntity.id,
        target_id: targetEntity.id,
        relation_type: input.relationType,
        confidence: input.confidence ?? 1,
        inferred: input.inferred ?? false,
        source_sha: config.sourceSha,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        created_at: new Date(),
      })
      .onConflict((oc) =>
        oc.columns(["source_id", "target_id", "relation_type"]).doUpdateSet({
          confidence: input.confidence ?? 1,
          inferred: input.inferred ?? false,
          source_sha: config.sourceSha,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        }),
      )
      .execute();

    await audit(db, "UPSERT", "qa_.relations", undefined, {
      source: sourceSlug,
      target: targetSlug,
      relation: input.relationType,
    });
  }

  async function retrieveContext(
    input: RetrieveContextInput,
  ): Promise<QaContextPack> {
    const topK = Math.min(
      input.topK ?? config.ragTopK,
      config.ragMaxContextTokens / 100,
    );
    const queryTerms = input.query
      .toLowerCase()
      .split(/\s+/u)
      .filter((term) => term.length > 2);

    let memoryQuery = db
      .selectFrom("qa_.memory_items")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(topK * 2);

    if (input.filters?.kinds && input.filters.kinds.length > 0) {
      memoryQuery = memoryQuery.where("kind", "in", input.filters.kinds);
    }
    if (input.filters?.sourceSha) {
      memoryQuery = memoryQuery.where("source_sha", "=", input.filters.sourceSha);
    }
    if (input.filters?.scope) {
      memoryQuery = memoryQuery.where("scope", "=", input.filters.scope);
    }
    if (input.filters?.environment) {
      memoryQuery = memoryQuery.where(
        "environment",
        "=",
        input.filters.environment,
      );
    }

    const items = await memoryQuery.execute();

    const scored = items
      .map((item) => {
        const content = `${item.title} ${item.content ?? ""}`.toLowerCase();
        const score = queryTerms.reduce(
          (acc, term) => acc + (content.includes(term) ? 1 : 0),
          0,
        );
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    const memoryItemViews: QaMemoryItemView[] = scored.map(({ item }) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      content: item.content,
      sourceSha: item.source_sha,
      createdAt: item.created_at,
    }));

    const entityIds = new Set<string>();
    const entityRows = await db
      .selectFrom("qa_.entities")
      .selectAll()
      .limit(topK)
      .execute();

    for (const entity of entityRows) {
      if (
        queryTerms.some(
          (term) =>
            entity.name.toLowerCase().includes(term) ||
            entity.type.toLowerCase().includes(term),
        )
      ) {
        entityIds.add(entity.id);
      }
    }

    const relationSourceIds = Array.from(entityIds);
    const relations = relationSourceIds.length
      ? await db
          .selectFrom("qa_.relations")
          .innerJoin(
            "qa_.entities as source",
            "qa_.relations.source_id",
            "source.id",
          )
          .innerJoin(
            "qa_.entities as target",
            "qa_.relations.target_id",
            "target.id",
          )
          .where((eb) =>
            eb.or([
              eb("qa_.relations.source_id", "in", relationSourceIds),
              eb("qa_.relations.target_id", "in", relationSourceIds),
            ]),
          )
          .select([
            "source.type as source_type",
            "source.name as source_name",
            "qa_.relations.relation_type",
            "target.type as target_type",
            "target.name as target_name",
            "qa_.relations.confidence",
          ])
          .limit(topK * 2)
          .execute()
      : [];

    const relationViews: QaRelationView[] = relations.map(
      (r: {
        source_type: string;
        source_name: string;
        relation_type: string;
        target_type: string;
        target_name: string;
        confidence: number;
      }) => ({
        sourceType: r.source_type,
        sourceName: r.source_name,
        relationType: r.relation_type,
        targetType: r.target_type,
        targetName: r.target_name,
        confidence: r.confidence,
      }),
    );

    const tokenEstimate = memoryItemViews.reduce(
      (acc, item) =>
        acc + (item.title.length + (item.content?.length ?? 0)) / 4,
      relationViews.length * 50,
    );

    const maxTokens = input.maxTokens ?? config.ragMaxContextTokens;
    const filteredItems: QaMemoryItemView[] = [];
    let currentTokens = tokenEstimate;
    for (const item of memoryItemViews) {
      const itemTokens =
        (item.title.length + (item.content?.length ?? 0)) / 4;
      if (currentTokens + itemTokens > maxTokens) {
        break;
      }
      filteredItems.push(item);
      currentTokens += itemTokens;
    }

    return {
      memoryItems: filteredItems,
      entities: entityRows.map((e) => ({
        id: e.id,
        type: e.type,
        name: e.name,
        slug: e.slug,
        description: e.description,
      })),
      relations: relationViews,
      tokenEstimate: Math.round(currentTokens),
      sources: filteredItems.map((item) => item.id),
    };
  }

  async function invalidateEvidence(memoryItemId: string): Promise<void> {
    await db
      .updateTable("qa_.memory_items")
      .where("id", "=", memoryItemId)
      .set({
        metadata: JSON.stringify({ invalidated: true }),
        updated_at: new Date(),
      })
      .execute();
    await audit(db, "INVALIDATE", "qa_.memory_items", memoryItemId, {
      invalidated: true,
    });
  }

  async function compactMemory(maxAgeDays = 90): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);
    const result = await sql<{ deleted: bigint }>`
      DELETE FROM qa_.memory_items
      WHERE updated_at < ${cutoff.toISOString()}
        AND COALESCE(metadata ->> 'invalidated', 'false') = 'true'
      RETURNING id
    `.execute(db);
    const deleted = result.rows.length;
    await audit(db, "COMPACT", "qa_.memory_items", undefined, {
      deleted,
      maxAgeDays,
    });
    return deleted;
  }

  async function explainWhyTestWasSelected(
    command: string,
    changeId: string,
  ): Promise<string> {
    const escapedCommand = command.replaceAll("%", "\\%").replaceAll("_", "\\_");
    const related = await db
      .selectFrom("qa_.memory_items")
      .selectAll()
      .where("change_id", "=", changeId)
      .where("kind", "in", ["semantic", "procedural", "learning"])
      .where((eb) =>
        eb.or([
          eb("title", "ilike", `%${escapedCommand}%`),
          eb("content", "ilike", `%${escapedCommand}%`),
        ]),
      )
      .limit(5)
      .execute();

    if (related.length === 0) {
      return `No stored rationale found for "${command}" in change ${changeId}.`;
    }

    return related
      .map(
        (item) =>
          `- ${item.title}: ${item.content ?? ""}`.slice(0, 200),
      )
      .join("\n");
  }

  function computeFingerprintLocal(input: FingerprintInput): Fingerprint {
    return computeFingerprint(input);
  }

  async function recordFingerprint(
    fingerprint: Fingerprint,
    resultStatus: string,
    resultId?: string,
  ): Promise<void> {
    await db
      .insertInto("qa_.fingerprints")
      .values({
        id: randomUUID(),
        change_id: config.changeId,
        source_sha: fingerprint.sourceSha,
        lockfile_hash: fingerprint.lockfileHash,
        migration_hash: fingerprint.migrationHash,
        config_hash: fingerprint.configHash,
        test_version: fingerprint.testVersion,
        fixture_hash: fingerprint.fixtureHash,
        env_fingerprint: fingerprint.envFingerprint,
        browser: fingerprint.browser,
        affected_closure: JSON.stringify(fingerprint.affectedClosure),
        result_status: resultStatus,
        result_id: resultId,
        created_at: new Date(),
      })
      .execute();
  }

  async function isFingerprintValid(
    fingerprint: Fingerprint,
  ): Promise<boolean> {
    const match = await db
      .selectFrom("qa_.fingerprints")
      .selectAll()
      .where("source_sha", "=", fingerprint.sourceSha)
      .where("lockfile_hash", "=", fingerprint.lockfileHash)
      .where("migration_hash", "=", fingerprint.migrationHash)
      .where("config_hash", "=", fingerprint.configHash)
      .where("test_version", "=", fingerprint.testVersion)
      .where("fixture_hash", "=", fingerprint.fixtureHash)
      .where("env_fingerprint", "=", fingerprint.envFingerprint)
      .where("browser", "=", fingerprint.browser)
      .where("result_status", "=", "PASS")
      .where("expires_at", "is", null)
      .executeTakeFirst();

    if (!match) return false;

    const stored = match.affected_closure
      ? Array.isArray(match.affected_closure)
        ? (match.affected_closure as string[])
        : (JSON.parse(match.affected_closure as string) as string[])
      : [];
    const current = fingerprint.affectedClosure;
    return (
      stored.length === current.length &&
      stored.every((file, index) => file === current[index])
    );
  }

  return {
    rememberFact,
    recordTestRun,
    recordEvidence,
    upsertGraphRelation,
    retrieveContext,
    invalidateEvidence,
    compactMemory,
    explainWhyTestWasSelected,
    computeFingerprint: computeFingerprintLocal,
    recordFingerprint,
    isFingerprintValid,
    close: async () => closeQaDb(db),
  };
}
