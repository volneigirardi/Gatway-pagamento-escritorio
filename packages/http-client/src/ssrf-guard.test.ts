import { describe, it, expect } from "vitest";
import { assertPublicHttpUrl, SsrfBlockedError } from "./ssrf-guard.js";

describe("assertPublicHttpUrl", () => {
  it("blocks loopback IPv4 addresses", async () => {
    await expect(assertPublicHttpUrl("http://127.0.0.1/")).rejects.toThrow(
      SsrfBlockedError,
    );
  });

  it("blocks the cloud metadata address", async () => {
    await expect(
      assertPublicHttpUrl("http://169.254.169.254/latest/meta-data/"),
    ).rejects.toThrow(SsrfBlockedError);
  });

  it("blocks private RFC1918 ranges", async () => {
    await expect(assertPublicHttpUrl("http://10.0.0.5/")).rejects.toThrow(
      SsrfBlockedError,
    );
    await expect(assertPublicHttpUrl("http://192.168.1.1/")).rejects.toThrow(
      SsrfBlockedError,
    );
    await expect(assertPublicHttpUrl("http://172.16.0.1/")).rejects.toThrow(
      SsrfBlockedError,
    );
  });

  it("blocks IPv6 loopback and unique-local", async () => {
    await expect(assertPublicHttpUrl("http://[::1]/")).rejects.toThrow(
      SsrfBlockedError,
    );
    await expect(assertPublicHttpUrl("http://[fd00::1]/")).rejects.toThrow(
      SsrfBlockedError,
    );
  });

  it("rejects non-http(s) protocols", async () => {
    await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toThrow(
      SsrfBlockedError,
    );
  });

  it("allows an explicitly allow-listed host regardless of resolution", async () => {
    await expect(
      assertPublicHttpUrl("http://localhost/", {
        allowedHosts: ["localhost"],
      }),
    ).resolves.toBeUndefined();
  });

  it("allows a public IPv4 address", async () => {
    await expect(assertPublicHttpUrl("http://8.8.8.8/")).resolves.toBeUndefined();
  });
});
