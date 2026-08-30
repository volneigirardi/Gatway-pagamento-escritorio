import { randomBytes } from "node:crypto";
import { Secret, TOTP } from "otpauth";

export interface TotpService {
  generateSecret(): Promise<string>;
  getUri(secret: string, accountName: string, issuer: string): Promise<string>;
  verify(code: string, secret: string): Promise<boolean>;
  verifyAndGetStep(
    code: string,
    secret: string,
    timestamp?: number,
  ): Promise<number | null>;
  generateBackupCodes(): Promise<string[]>;
}

export class OtpAuthTotpService implements TotpService {
  async generateSecret(): Promise<string> {
    return new Secret({ size: 20 }).base32;
  }

  async getUri(
    secret: string,
    accountName: string,
    issuer: string,
  ): Promise<string> {
    if (accountName.length === 0 || issuer.length === 0) {
      throw new Error("TOTP account name and issuer are required");
    }

    return new TOTP({
      issuer,
      label: accountName,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    }).toString();
  }

  async verify(code: string, secret: string): Promise<boolean> {
    return (await this.verifyAndGetStep(code, secret)) !== null;
  }

  async verifyAndGetStep(
    code: string,
    secret: string,
    timestamp = Date.now(),
  ): Promise<number | null> {
    if (!/^\d{6}$/u.test(code) || !/^[A-Z2-7]{32}$/u.test(secret)) {
      return null;
    }

    try {
      const delta = new TOTP({
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(secret),
      }).validate({ token: code, timestamp, window: 1 });
      return delta === null ? null : Math.floor(timestamp / 30_000) + delta;
    } catch {
      return null;
    }
  }

  async generateBackupCodes(): Promise<string[]> {
    return Array.from({ length: 10 }, () => {
      const value = randomBytes(6).toString("hex").toUpperCase();
      return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`;
    });
  }
}
