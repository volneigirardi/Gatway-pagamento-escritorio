import { z } from "zod";

const commonPasswords = new Set([
  "123456789012",
  "admin123456",
  "administrator",
  "changeme1234",
  "letmein123456",
  "password1234",
  "qwerty123456",
  "senha123456",
  "welcome12345",
]);

export const passwordPolicySchema = z
  .string()
  .min(12)
  .max(128)
  .refine((password) => !/[\u0000\r\n]/u.test(password), {
    message: "Password contains forbidden control characters",
  })
  .refine((password) => password.trim().length === password.length, {
    message: "Password cannot start or end with whitespace",
  })
  .refine((password) => !commonPasswords.has(password.toLowerCase()), {
    message: "Password is too common",
  });

export function validatePasswordPolicy(password: string): void {
  const result = passwordPolicySchema.safeParse(password);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Invalid password");
  }
}
