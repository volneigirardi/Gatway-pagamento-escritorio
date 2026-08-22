export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export class Argon2idPasswordHasher implements PasswordHasher {
  constructor(
    private readonly memoryKib: number,
    private readonly iterations: number,
    private readonly parallelism: number,
  ) {}

  async hash(_password: string): Promise<string> {
    void this.memoryKib;
    void this.iterations;
    void this.parallelism;
    throw new Error(
      "Argon2id implementation requires native dependency; integrate @node-rs/argon2 or argon2 in a dedicated build step",
    );
  }

  async verify(_password: string, _hash: string): Promise<boolean> {
    throw new Error(
      "Argon2id implementation requires native dependency; integrate @node-rs/argon2 or argon2 in a dedicated build step",
    );
  }
}
