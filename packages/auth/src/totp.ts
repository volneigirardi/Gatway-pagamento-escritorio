export interface TotpService {
  generateSecret(): Promise<string>;
  getUri(secret: string, accountName: string, issuer: string): Promise<string>;
  verify(code: string, secret: string): Promise<boolean>;
  generateBackupCodes(): Promise<string[]>;
}

export class PlaceholderTotpService implements TotpService {
  async generateSecret(): Promise<string> {
    return "placeholder-secret";
  }
  async getUri(
    _secret: string,
    _accountName: string,
    _issuer: string,
  ): Promise<string> {
    return "otpauth://placeholder";
  }
  async verify(_code: string, _secret: string): Promise<boolean> {
    return false;
  }
  async generateBackupCodes(): Promise<string[]> {
    return Array.from({ length: 8 }, () => "00000000");
  }
}
