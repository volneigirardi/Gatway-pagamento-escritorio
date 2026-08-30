import { randomUUID } from "node:crypto";
import type { QaConfig } from "./config.js";
import {
  QaStateMachine,
  type QaEvent,
  type StateTransition,
} from "./state-machine.js";
import {
  commandResultSchema,
  qaCycleSchema,
  type CommandResult,
  type QaCycle,
} from "./output.js";
import { createMemoryStore, type MemoryStore } from "./memory-store.js";

export interface CommandContext {
  readonly config: QaConfig;
  readonly machine: QaStateMachine;
}

export function newCommandContext(config: QaConfig): CommandContext {
  return {
    config,
    machine: new QaStateMachine(),
  };
}

function openMemoryStore(
  config: QaConfig,
): MemoryStore | undefined {
  if (!config.databaseUrl) {
    return undefined;
  }
  try {
    return createMemoryStore(config, {
      connectionString: config.databaseUrl,
    });
  } catch {
    return undefined;
  }
}

export function transition(
  context: CommandContext,
  event: QaEvent,
): StateTransition {
  return context.machine.transition(event);
}

export async function preflight(context: CommandContext): Promise<CommandResult> {
  const start = Date.now();
  const checks: string[] = [];

  try {
    checks.push(`Node.js: ${process.version}`);
    checks.push(`Platform: ${process.platform}`);
    checks.push(`Project root: ${context.config.projectRoot}`);
    checks.push(`Environment: ${context.config.environment}`);
    checks.push(`Scope: ${context.config.scope}`);
    checks.push(`Source SHA: ${context.config.sourceSha}`);
    if (context.config.baseSha) {
      checks.push(`Base SHA: ${context.config.baseSha}`);
    }
  } catch (error) {
    return commandResultSchema.parse({
      command: "qa:preflight",
      exitCode: 1,
      status: "FAIL",
      durationMs: Date.now() - start,
      error: String(error),
    });
  }

  const result = commandResultSchema.parse({
    command: "qa:preflight",
    exitCode: 0,
    status: "PASS",
    durationMs: Date.now() - start,
    output: checks.join("\n"),
  });

  const store = openMemoryStore(context.config);
  if (store) {
    const runId = await store.recordTestRun({
      scope: context.config.scope,
      environment: context.config.environment,
      status: result.status,
      durationMs: result.durationMs,
      results: [result],
    });
    await store.recordFingerprint(
      store.computeFingerprint({ config: context.config }),
      result.status,
      runId,
    );
    await store.close();
  }

  return result;
}

export async function baseline(context: CommandContext): Promise<CommandResult> {
  const start = Date.now();
  const output = [
    "Baseline recorded:",
    `- changeId: ${context.config.changeId}`,
    `- scope: ${context.config.scope}`,
    `- environment: ${context.config.environment}`,
    `- sourceSha: ${context.config.sourceSha}`,
    `- baseSha: ${context.config.baseSha ?? "none"}`,
  ].join("\n");

  const result = commandResultSchema.parse({
    command: "qa:baseline",
    exitCode: 0,
    status: "PASS",
    durationMs: Date.now() - start,
    output,
  });

  const store = openMemoryStore(context.config);
  if (store) {
    await store.rememberFact({
      kind: "episodic",
      title: `QA baseline recorded for ${context.config.changeId}`,
      content: output,
    });
    await store.close();
  }

  return result;
}

export function impact(_context: CommandContext): CommandResult {
  const start = Date.now();
  return commandResultSchema.parse({
    command: "qa:impact",
    exitCode: 0,
    status: "SKIPPED",
    durationMs: Date.now() - start,
    output:
      "Impact analysis engine is a stub. Full diff-to-module mapping will be implemented in Part 6.",
  });
}

export function verify(_context: CommandContext): CommandResult {
  const start = Date.now();
  return commandResultSchema.parse({
    command: "qa:verify",
    exitCode: 0,
    status: "SKIPPED",
    durationMs: Date.now() - start,
    output:
      "Verification engine is a stub. Test execution orchestration will be implemented in Part 5.",
  });
}

export function retest(_context: CommandContext): CommandResult {
  const start = Date.now();
  return commandResultSchema.parse({
    command: "qa:retest",
    exitCode: 0,
    status: "SKIPPED",
    durationMs: Date.now() - start,
    output:
      "Retest engine is a stub. Independent retest workflow will be implemented in Part 7.",
  });
}

export function releaseGate(_context: CommandContext): CommandResult {
  const start = Date.now();
  return commandResultSchema.parse({
    command: "qa:release-gate",
    exitCode: 0,
    status: "SKIPPED",
    durationMs: Date.now() - start,
    output:
      "Release gate engine is a stub. Full attestation and evidence validation will be implemented in Part 9.",
  });
}

export function buildCycle(
  context: CommandContext,
  commandResults: Record<string, CommandResult>,
): QaCycle {
  const anyFail = Object.values(commandResults).some(
    (r) => r.status === "FAIL",
  );
  const anyInconclusive = Object.values(commandResults).some(
    (r) => r.status === "INCONCLUSIVE",
  );

  let gateDecision: QaCycle["gateDecision"];
  if (anyFail) {
    gateDecision = "BLOQUEADA";
  } else if (anyInconclusive) {
    gateDecision = "INCONCLUSIVA";
  } else {
    gateDecision = "APROVADA";
  }

  const now = new Date().toISOString();

  return qaCycleSchema.parse({
    cycleId: randomUUID(),
    changeId: context.config.changeId,
    scope: context.config.scope,
    environment: context.config.environment,
    sourceSha: context.config.sourceSha,
    baseSha: context.config.baseSha,
    state: context.machine.current,
    risk: "medium",
    startedAt: now,
    finishedAt: now,
    testPlan: [],
    results: commandResults,
    defects: [],
    evidenceLinks: [],
    gateDecision,
  });
}
