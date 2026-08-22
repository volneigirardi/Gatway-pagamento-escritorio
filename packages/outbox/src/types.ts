import { z } from "zod";

export const outboxEventSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  aggregateType: z.string().min(1).max(128),
  aggregateId: z.string().uuid(),
  type: z.string().min(1).max(128),
  payload: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
});

export type OutboxEvent = z.infer<typeof outboxEventSchema>;
