#!/usr/bin/env node
/* eslint-disable no-console */
import { parseQaConfig } from "./config.js";
import {
  baseline,
  buildCycle,
  impact,
  newCommandContext,
  preflight,
  releaseGate,
  retest,
  transition,
  verify,
} from "./commands.js";
import { formatCycleJson, type CommandResult } from "./output.js";

const command = process.argv[2];

function usage(): string {
  return `Usage: qa-agent <command>

Commands:
  preflight     validate QA environment
  baseline      record the baseline for a change
  impact        (stub) analyze impact of a diff
  verify        (stub) run the selected test plan
  retest        (stub) retest a previously reported defect
  release-gate  (stub) evaluate release readiness

Required environment variables for non-preflight commands:
  QA_CHANGE_ID, QA_SCOPE, QA_ENVIRONMENT, QA_SOURCE_SHA

Optional:
  QA_DATABASE_URL      PostgreSQL connection for persistent QA memory
  QA_PROJECT_ROOT      path to project root (default: .)
  QA_RAG_TOP_K         default 8
  QA_RAG_MAX_CONTEXT_TOKENS default 6000
`;
}

async function main(): Promise<void> {
  if (!command) {
    console.error(usage());
    process.exit(1);
  }

  const config = parseQaConfig({
    changeId: process.env["QA_CHANGE_ID"] ?? "unknown",
    scope: process.env["QA_SCOPE"] ?? "smoke",
    environment: process.env["QA_ENVIRONMENT"] ?? "local",
    sourceSha: process.env["QA_SOURCE_SHA"] ?? "0".repeat(40),
    baseSha: process.env["QA_BASE_SHA"],
    projectRoot: process.env["QA_PROJECT_ROOT"] ?? ".",
    databaseUrl: process.env["QA_DATABASE_URL"],
    ragTopK: process.env["QA_RAG_TOP_K"],
    ragMaxContextTokens: process.env["QA_RAG_MAX_CONTEXT_TOKENS"],
    memoryWriteMaxTokens: process.env["QA_MEMORY_WRITE_MAX_TOKENS"],
    maxTriageItemsPerBatch: process.env["QA_MAX_TRIAGE_ITEMS_PER_BATCH"],
  });

  const context = newCommandContext(config);
  const commandResults: Record<string, CommandResult> = {};

  switch (command) {
    case "preflight": {
      transition(context, "START");
      const result = await preflight(context);
      commandResults[command] = result;
      break;
    }
    case "baseline": {
      transition(context, "START");
      const result = await baseline(context);
      commandResults[command] = result;
      break;
    }
    case "impact": {
      transition(context, "START");
      const result = impact(context);
      commandResults[command] = result;
      break;
    }
    case "verify": {
      transition(context, "START");
      const result = verify(context);
      commandResults[command] = result;
      break;
    }
    case "retest": {
      transition(context, "RETEST");
      const result = retest(context);
      commandResults[command] = result;
      break;
    }
    case "release-gate": {
      transition(context, "START");
      const result = releaseGate(context);
      commandResults[command] = result;
      break;
    }
    default:
      console.error(`Unknown command: ${command}\n${usage()}`);
      process.exit(1);
  }

  transition(context, "PASS");
  const cycle = buildCycle(context, commandResults);
  console.log(formatCycleJson(cycle));
}

void main();
