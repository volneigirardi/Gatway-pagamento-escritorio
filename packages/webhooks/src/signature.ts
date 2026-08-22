import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifyInboundOptions {
  /** Max allowed clock skew between the signed timestamp and now. Default 5 minutes. */
  toleranceSeconds?: number;
  now?: () => number;
}

export class WebhookSignatureError extends Error {
  constructor(reason: string) {
    super(`Webhook signature verification failed: ${reason}`);
    this.name = "WebhookSignatureError";
  }
}

/**
 * Signs `rawBody` the same way Stripe/GitHub-style webhook signers do:
 * HMAC-SHA256 over `${timestamp}.${rawBody}`, hex-encoded.
 */
export function signWebhookPayload(
  secret: string,
  timestampSeconds: number,
  rawBody: string,
): string {
  return createHmac("sha256", secret)
    .update(`${String(timestampSeconds)}.${rawBody}`)
    .digest("hex");
}

/**
 * Verifies an inbound webhook signature header of the form
 * `t=<unix_seconds>,v1=<hex_hmac>`. Requires the RAW request body — never
 * verify against a re-serialized/parsed JSON object, since re-serialization
 * can change byte-for-byte content and always break signature verification
 * (or worse, silently accept a tampered payload if parsing is lossy).
 *
 * Throws `WebhookSignatureError` on any failure; callers should respond
 * 400/401 without leaking which check failed.
 */
export function verifyInboundWebhookSignature(
  secret: string,
  signatureHeader: string | undefined,
  rawBody: string,
  options: VerifyInboundOptions = {},
): void {
  if (!signatureHeader) {
    throw new WebhookSignatureError("missing signature header");
  }

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key ?? "", value ?? ""];
    }),
  );

  const timestamp = Number(parts["t"]);
  const providedSignature = parts["v1"];
  if (!Number.isFinite(timestamp) || !providedSignature) {
    throw new WebhookSignatureError("malformed signature header");
  }

  const now = (options.now ?? Date.now)() / 1000;
  const tolerance = options.toleranceSeconds ?? 300;
  if (Math.abs(now - timestamp) > tolerance) {
    throw new WebhookSignatureError("timestamp outside replay window");
  }

  const expectedSignature = signWebhookPayload(secret, timestamp, rawBody);
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const providedBuffer = Buffer.from(providedSignature, "hex");
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new WebhookSignatureError("signature mismatch");
  }
}

/** Builds the `X-Webhook-Signature` header value for an outbound delivery. */
export function buildOutboundSignatureHeader(
  secret: string,
  rawBody: string,
  now: () => number = Date.now,
): string {
  const timestampSeconds = Math.floor(now() / 1000);
  const signature = signWebhookPayload(secret, timestampSeconds, rawBody);
  return `t=${String(timestampSeconds)},v1=${signature}`;
}
