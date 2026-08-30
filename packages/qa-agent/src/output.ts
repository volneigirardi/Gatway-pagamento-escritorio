import { z } from "zod";
import { qaStateSchema } from "./state-machine.js";
import { gitShaSchema, qaScopeSchema } from "./config.js";

export const commandResultSchema = z.object({
  command: z.string(),
  exitCode: z.number().int(),
  status: z.enum(["PASS", "FAIL", "SKIPPED", "INCONCLUSIVE"]),
  durationMs: z.number().int().nonnegative(),
  output: z.string().optional(),
  error: z.string().optional(),
});

export type CommandResult = z.infer<typeof commandResultSchema>;

export const defectSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  title: z.string(),
  description: z.string(),
  filePath: z.string().optional(),
  lineRange: z.string().optional(),
  status: z.enum(["open", "fixed", "retested", "closed"]).default("open"),
  retestResult: commandResultSchema.optional(),
});

export type Defect = z.infer<typeof defectSchema>;

export const qaCycleSchema = z.object({
  cycleId: z.uuid(),
  changeId: z.string().min(1),
  scope: qaScopeSchema,
  environment: z.enum(["local", "homologation", "staging", "production"]),
  sourceSha: gitShaSchema,
  baseSha: gitShaSchema.optional(),
  state: qaStateSchema,
  risk: z.enum(["low", "medium", "high", "critical"]),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().optional(),
  testPlan: z.array(
    z.object({
      command: z.string(),
      reason: z.string(),
    }),
  ),
  results: z.record(z.string(), commandResultSchema),
  defects: z.array(defectSchema),
  evidenceLinks: z.array(z.url()),
  gateDecision: z.enum(["APROVADA", "BLOQUEADA", "INCONCLUSIVA"]).optional(),
});

export type QaCycle = z.infer<typeof qaCycleSchema>;

export function formatCycleJson(cycle: QaCycle): string {
  return JSON.stringify(cycle, null, 2);
}

export function summarizeCycle(cycle: QaCycle): string {
  const passCount = Object.values(cycle.results).filter(
    (r) => r.status === "PASS",
  ).length;
  const failCount = Object.values(cycle.results).filter(
    (r) => r.status === "FAIL",
  ).length;
  const skipCount = Object.values(cycle.results).filter(
    (r) => r.status === "SKIPPED",
  ).length;
  const inconclusiveCount = Object.values(cycle.results).filter(
    (r) => r.status === "INCONCLUSIVE",
  ).length;

  return [
    `QA Cycle: ${cycle.cycleId}`,
    `Change: ${cycle.changeId} | Scope: ${cycle.scope} | Env: ${cycle.environment}`,
    `SHA: ${cycle.sourceSha}`,
    `State: ${cycle.state} | Risk: ${cycle.risk}`,
    `Results: ${String(passCount)} PASS, ${String(failCount)} FAIL, ${String(skipCount)} SKIPPED, ${String(inconclusiveCount)} INCONCLUSIVE`,
    `Defects: ${String(cycle.defects.length)}`,
    `Gate: ${cycle.gateDecision ?? "pending"}`,
  ].join("\n");
}
