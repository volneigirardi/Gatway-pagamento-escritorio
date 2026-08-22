import { createSafeHttpClient, type SafeHttpClient } from "@saas/http-client";
import { buildOutboundSignatureHeader } from "./signature.js";
import type {
  WebhookDeliveryAttempt,
  WebhookDeliveryPayload,
  WebhookSubscription,
} from "./types.js";

export interface WebhookDeliveryOptions {
  maxAttempts?: number;
  httpClient?: SafeHttpClient;
}

/**
 * Delivers one webhook event to one subscription. Returns the attempt
 * outcome instead of throwing so the caller (a queue worker) can persist it
 * to a delivery-log table, mark the event dead-letter after `maxAttempts`,
 * and decide on further retries via its own job backoff schedule — this
 * function does not loop internally to avoid holding a job/worker slot for
 * the full backoff window.
 */
export async function deliverWebhook(
  subscription: WebhookSubscription,
  payload: WebhookDeliveryPayload,
  attemptNumber: number,
  options: WebhookDeliveryOptions = {},
): Promise<WebhookDeliveryAttempt> {
  const maxAttempts = options.maxAttempts ?? 8;
  const client = options.httpClient ?? createSafeHttpClient();
  const rawBody = JSON.stringify(payload);
  const signatureHeader = buildOutboundSignatureHeader(
    subscription.secret,
    rawBody,
  );

  const base: Omit<WebhookDeliveryAttempt, "status"> = {
    subscriptionId: subscription.id,
    eventId: payload.eventId,
    attempt: attemptNumber,
    attemptedAt: new Date().toISOString(),
  };

  try {
    const response = await client.fetch(subscription.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": signatureHeader,
        "idempotency-key": `${subscription.id}:${payload.eventId}`,
      },
      body: rawBody,
    });

    if (response.ok) {
      return { ...base, status: "delivered", httpStatus: response.status };
    }

    return {
      ...base,
      status: attemptNumber >= maxAttempts ? "dead_letter" : "failed",
      httpStatus: response.status,
      error: `unexpected status ${String(response.status)}`,
    };
  } catch (err) {
    return {
      ...base,
      status: attemptNumber >= maxAttempts ? "dead_letter" : "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
