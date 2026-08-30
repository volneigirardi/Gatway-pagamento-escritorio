import { describe, expect, it } from "vitest";
import { Argon2idPasswordHasher } from "./password.js";
import { passwordPolicySchema } from "./password-policy.js";

describe("Argon2idPasswordHasher", () => {
  const hasher = new Argon2idPasswordHasher(8192, 1, 1);

  it("hashes and verifies without retaining plaintext", async () => {
    const password = "correct horse battery staple";
    const hash = await hasher.hash(password);

    expect(hash).toMatch(/^\$argon2id\$/u);
    expect(hash).not.toContain(password);
    await expect(hasher.verify(password, hash)).resolves.toBe(true);
    await expect(hasher.verify("incorrect password", hash)).resolves.toBe(
      false,
    );
  });

  it("rejects malformed hashes and unsafe configuration", async () => {
    await expect(hasher.verify("password", "not-a-hash")).resolves.toBe(false);
    expect(() => new Argon2idPasswordHasher(1024, 1, 1)).toThrow();
    expect(() => new Argon2idPasswordHasher(8192, 0, 1)).toThrow();
    expect(() => new Argon2idPasswordHasher(8192, 1, 0)).toThrow();
  });
});

describe("password policy", () => {
  it("accepts long non-common passwords", () => {
    expect(
      passwordPolicySchema.safeParse("Um segredo longo 2026!").success,
    ).toBe(true);
  });

  it("rejects short, common, or padded passwords", () => {
    expect(passwordPolicySchema.safeParse("short").success).toBe(false);
    expect(passwordPolicySchema.safeParse("password1234").success).toBe(false);
    expect(
      passwordPolicySchema.safeParse(" valid password 2026 ").success,
    ).toBe(false);
  });
});
