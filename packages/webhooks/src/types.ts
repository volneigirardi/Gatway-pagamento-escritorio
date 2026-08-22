import { z } from "zod";

export const webhookSubscriptionSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  url: z.url(),
  secret: z.string().min(32),
  eventTypes: z.array(z.string()).min(1),
  isActive: z.boolean().default(true),
});
export type WebhookSubscription = z.infer<typeof webhookSubscriptionSchema>;

export const webhookDeliveryPayloadSchema = z.object({
  eventId: z.uuid(),
  eventType: z.string(),
  tenantId: z.uuid(),
  occurredAt: z.iso.datetime(),
  data: z.unknown(),
});
export type WebhookDeliveryPayload = z.infer<
  typeof webhookDeliveryPayloadSchema
>;

export type WebhookDeliveryStatus = "delivered" | "failed" | "dead_letter";

export interface WebhookDeliveryAttempt {
  subscriptionId: string;
  eventId: string;
  attempt: number;
  status: WebhookDeliveryStatus;
  httpStatus?: number;
  error?: string;
  attemptedAt: string;
}
