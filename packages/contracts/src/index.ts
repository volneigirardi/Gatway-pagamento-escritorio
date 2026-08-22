import { z } from "zod";

export const healthStatusSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  timestamp: z.string().datetime(),
  version: z.string(),
  checks: z.record(z.string(), z.unknown()).optional(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: z
    .object({
      requestId: z.string().optional(),
      correlationId: z.string().optional(),
    })
    .optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z
      .object({
        requestId: z.string(),
        correlationId: z.string(),
        timestamp: z.string().datetime(),
      })
      .optional(),
  });
