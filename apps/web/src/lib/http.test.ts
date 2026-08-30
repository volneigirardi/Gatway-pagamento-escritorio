import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, rawApiRequest } from "./http.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("same-origin API transport", () => {
  it("uses the versioned relative prefix and same-origin credentials", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(rawApiRequest("/health")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/health",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("rejects protocol-relative paths", async () => {
    await expect(rawApiRequest("//external.test/path")).rejects.toThrow(
      "API path must be relative",
    );
  });

  it("returns a typed error for failed responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: "Denied" }), { status: 403 }),
        ),
    );
    await expect(rawApiRequest("/protected")).rejects.toEqual(
      new ApiError(403, "Denied"),
    );
  });
});
