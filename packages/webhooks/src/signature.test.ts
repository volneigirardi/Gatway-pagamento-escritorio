import { describe, it, expect } from "vitest";
import {
  buildOutboundSignatureHeader,
  verifyInboundWebhookSignature,
  WebhookSignatureError,
} from "./signature.js";

const SECRET = "test-webhook-secret-32-bytes-long!!";

describe("webhook signatures", () => {
  it("verifies a signature it just built", () => {
    const rawBody = JSON.stringify({ hello: "world" });
    const header = buildOutboundSignatureHeader(SECRET, rawBody);

    expect(() =>
      verifyInboundWebhookSignature(SECRET, header, rawBody),
    ).not.toThrow();
  });

  it("rejects a tampered body", () => {
    const rawBody = JSON.stringify({ hello: "world" });
    const header = buildOutboundSignatureHeader(SECRET, rawBody);
    const tamperedBody = JSON.stringify({ hello: "mallory" });

    expect(() =>
      verifyInboundWebhookSignature(SECRET, header, tamperedBody),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects a missing signature header", () => {
    expect(() =>
      verifyInboundWebhookSignature(SECRET, undefined, "{}"),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects a stale timestamp (replay)", () => {
    const rawBody = "{}";
    const oldNow = () => Date.now() - 10 * 60 * 1000; // 10 minutes ago
    const header = buildOutboundSignatureHeader(SECRET, rawBody, oldNow);

    expect(() =>
      verifyInboundWebhookSignature(SECRET, header, rawBody, {
        toleranceSeconds: 300,
      }),
    ).toThrow(WebhookSignatureError);
  });

  it("rejects a signature signed with a different secret", () => {
    const rawBody = "{}";
    const header = buildOutboundSignatureHeader("a-completely-different-secret!!", rawBody);

    expect(() =>
      verifyInboundWebhookSignature(SECRET, header, rawBody),
    ).toThrow(WebhookSignatureError);
  });
});
