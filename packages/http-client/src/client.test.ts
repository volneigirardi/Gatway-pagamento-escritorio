import { describe, it, expect, vi } from "vitest";
import { createSafeHttpClient } from "./client.js";
import { SsrfBlockedError } from "./ssrf-guard.js";

describe("createSafeHttpClient", () => {
  it("blocks requests to private addresses before calling fetch", async () => {
    const fetchImpl = vi.fn();
    const client = createSafeHttpClient({ fetchImpl });

    await expect(client.fetch("https://127.0.0.1/")).rejects.toThrow(
      SsrfBlockedError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects plaintext HTTP unless explicitly enabled", async () => {
    const fetchImpl = vi.fn();
    const client = createSafeHttpClient({ fetchImpl });

    await expect(client.fetch("http://8.8.8.8/")).rejects.toThrow(
      SsrfBlockedError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("passes through a successful request to a public URL", async () => {
    const response = new Response("ok", { status: 200 });
    const fetchImpl = vi.fn().mockResolvedValue(response);
    const client = createSafeHttpClient({ fetchImpl, timeoutMs: 1000 });

    const result = await client.fetch("https://8.8.8.8/");

    expect(result.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a failed GET request up to maxRetries", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const client = createSafeHttpClient({
      fetchImpl,
      timeoutMs: 1000,
      maxRetries: 2,
    });

    const result = await client.fetch("https://8.8.8.8/");

    expect(result.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry a POST without an Idempotency-Key", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network error"));
    const client = createSafeHttpClient({
      fetchImpl,
      timeoutMs: 1000,
      maxRetries: 3,
    });

    await expect(
      client.fetch("https://8.8.8.8/", { method: "POST" }),
    ).rejects.toThrow("network error");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a POST that carries an Idempotency-Key", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(new Response("ok", { status: 201 }));
    const client = createSafeHttpClient({
      fetchImpl,
      timeoutMs: 1000,
      maxRetries: 2,
    });

    const result = await client.fetch("https://8.8.8.8/", {
      method: "POST",
      headers: { "Idempotency-Key": "abc-123" },
    });

    expect(result.status).toBe(201);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
