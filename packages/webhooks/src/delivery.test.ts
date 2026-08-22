import { describe, it, expect, vi } from "vitest";
import { deliverWebhook } from "./delivery.js";
import type { WebhookSubscription, WebhookDeliveryPayload } from "./types.js";

const subscription: WebhookSubscription = {
  id: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  url: "https://example.com/webhooks/inbound",
  secret: "test-webhook-secret-32-bytes-long!!",
  eventTypes: ["invoice.created"],
  isActive: true,
};

const payload: WebhookDeliveryPayload = {
  eventId: "33333333-3333-4333-8333-333333333333",
  eventType: "invoice.created",
  tenantId: subscription.tenantId,
  occurredAt: new Date().toISOString(),
  data: { amount: 100 },
};

describe("deliverWebhook", () => {
  it("marks delivery successful on 2xx response", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const result = await deliverWebhook(subscription, payload, 1, {
      httpClient: { fetch },
    });

    expect(result.status).toBe("delivered");
    expect(fetch).toHaveBeenCalledWith(
      subscription.url,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-webhook-signature": expect.any(String),
          "idempotency-key": `${subscription.id}:${payload.eventId}`,
        }),
      }),
    );
  });

  it("marks as failed (not dead_letter) below maxAttempts on non-2xx", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("error", { status: 500 }));
    const result = await deliverWebhook(subscription, payload, 1, {
      httpClient: { fetch },
      maxAttempts: 8,
    });

    expect(result.status).toBe("failed");
    expect(result.httpStatus).toBe(500);
  });

  it("marks as dead_letter once maxAttempts is reached", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("error", { status: 500 }));
    const result = await deliverWebhook(subscription, payload, 8, {
      httpClient: { fetch },
      maxAttempts: 8,
    });

    expect(result.status).toBe("dead_letter");
  });

  it("marks as dead_letter on network failure at the last attempt", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await deliverWebhook(subscription, payload, 3, {
      httpClient: { fetch },
      maxAttempts: 3,
    });

    expect(result.status).toBe("dead_letter");
    expect(result.error).toContain("ECONNREFUSED");
  });
});
