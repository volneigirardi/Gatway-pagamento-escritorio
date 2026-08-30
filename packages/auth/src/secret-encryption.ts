import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";
const additionalData = Buffer.from("blupo:auth-secret:v1", "utf8");

function encryptionKey(key: Uint8Array): Buffer {
  if (key.byteLength !== 32) {
    throw new Error("Encryption key must be exactly 32 bytes");
  }
  return Buffer.from(key);
}

export function encryptAuthSecret(plaintext: string, key: Uint8Array): string {
  if (plaintext.length === 0 || plaintext.length > 4096) {
    throw new Error("Secret length must be between 1 and 4096 characters");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, encryptionKey(key), iv);
  cipher.setAAD(additionalData);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptAuthSecret(encrypted: string, key: Uint8Array): string {
  if (encrypted.length === 0 || encrypted.length > 8192) {
    throw new Error("Encrypted secret has an invalid length");
  }

  const [version, ivValue, tagValue, ciphertextValue, extra] =
    encrypted.split(".");
  if (
    version !== "v1" ||
    !ivValue ||
    !tagValue ||
    !ciphertextValue ||
    extra !== undefined
  ) {
    throw new Error("Encrypted secret has an invalid format");
  }

  const iv = Buffer.from(ivValue, "base64url");
  const tag = Buffer.from(tagValue, "base64url");
  const ciphertext = Buffer.from(ciphertextValue, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error("Encrypted secret has invalid components");
  }

  const decipher = createDecipheriv(algorithm, encryptionKey(key), iv);
  decipher.setAAD(additionalData);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
