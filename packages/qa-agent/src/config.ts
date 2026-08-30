import { z } from "zod";

export const qaEnvironmentSchema = z.enum([
  "local",
  "homologation",
  "staging",
  "production",
]);

export type QaEnvironment = z.infer<typeof qaEnvironmentSchema>;

export const qaScopeSchema = z.enum([
  "smoke",
  "targeted",
  "expanded",
  "full",
  "release",
]);

export type QaScope = z.infer<typeof qaScopeSchema>;

export const gitShaSchema = z
  .string()
  .regex(/^[0-9a-f]{40}$/u, "Expected a full 40-character git SHA");

export const qaConfigSchema = z.object({
  changeId: z.string().min(1),
  scope: qaScopeSchema,
  environment: qaEnvironmentSchema.default("local"),
  sourceSha: gitShaSchema,
  baseSha: gitShaSchema.optional(),
  projectRoot: z.string().min(1).default("."),
  databaseUrl: z.url().optional(),
  ragTopK: z.coerce.number().int().min(1).max(100).default(8),
  ragMaxContextTokens: z.coerce.number().int().min(100).default(6000),
  memoryWriteMaxTokens: z.coerce.number().int().min(0).default(600),
  maxTriageItemsPerBatch: z.coerce.number().int().min(1).default(10),
});

export type QaConfig = z.infer<typeof qaConfigSchema>;

export function parseQaConfig(input: Record<string, unknown>): QaConfig {
  const parsed = qaConfigSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Invalid QA config:\n${issues.join("\n")}`);
  }
  return parsed.data;
}
