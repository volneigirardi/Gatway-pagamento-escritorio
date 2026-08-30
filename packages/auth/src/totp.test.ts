import { Secret, TOTP } from "otpauth";
import { describe, expect, it } from "vitest";
import { OtpAuthTotpService } from "./totp.js";

const service = new OtpAuthTotpService();

describe("OtpAuthTotpService", () => {
  it("creates authenticator-compatible secrets and URIs", async () => {
    const secret = await service.generateSecret();
    const uri = await service.getUri(secret, "owner@blupo.com.br", "Blupo");

    expect(secret).toMatch(/^[A-Z2-7]{32}$/u);
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("issuer=Blupo");
  });

  it("verifies current codes and rejects malformed codes", async () => {
    const secret = await service.generateSecret();
    const timestamp = Date.now();
    const code = TOTP.generate({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      timestamp,
      secret: Secret.fromBase32(secret),
    });

    await expect(service.verify(code, secret)).resolves.toBe(true);
    await expect(
      service.verifyAndGetStep(code, secret, timestamp),
    ).resolves.toBe(Math.floor(timestamp / 30_000));
    await expect(service.verify("00000x", secret)).resolves.toBe(false);
    await expect(service.verify(code, "invalid-secret")).resolves.toBe(false);
  });

  it("generates unique recovery codes", async () => {
    const codes = await service.generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(
      codes.every((code) => /^[A-F0-9]{4}(?:-[A-F0-9]{4}){2}$/u.test(code)),
    ).toBe(true);
  });
});
