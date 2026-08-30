import { hash as hashArgon2, verify as verifyArgon2 } from "@node-rs/argon2";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export class Argon2idPasswordHasher implements PasswordHasher {
  constructor(
    private readonly memoryKib: number,
    private readonly iterations: number,
    private readonly parallelism: number,
  ) {
    if (
      !Number.isInteger(memoryKib) ||
      memoryKib < 8192 ||
      memoryKib > 262144
    ) {
      throw new Error("Argon2 memory must be between 8192 and 262144 KiB");
    }
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10) {
      throw new Error("Argon2 iterations must be between 1 and 10");
    }
    if (!Number.isInteger(parallelism) || parallelism < 1 || parallelism > 16) {
      throw new Error("Argon2 parallelism must be between 1 and 16");
    }
  }

  async hash(password: string): Promise<string> {
    if (password.length === 0 || password.length > 1024) {
      throw new Error("Password length must be between 1 and 1024 characters");
    }

    return hashArgon2(password, {
      memoryCost: this.memoryKib,
      timeCost: this.iterations,
      parallelism: this.parallelism,
      outputLen: 32,
    });
  }

  async verify(password: string, hash: string): Promise<boolean> {
    if (
      password.length === 0 ||
      password.length > 1024 ||
      hash.length === 0 ||
      hash.length > 1024 ||
      !hash.startsWith("$argon2id$")
    ) {
      return false;
    }

    try {
      return await verifyArgon2(hash, password);
    } catch {
      return false;
    }
  }
}
