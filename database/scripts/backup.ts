import { execFile } from "node:child_process";
import { randomUUID, createCipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * AES-256-GCM key used to encrypt backups at rest, matching the project's
 * encryption standard (docs/security/secrets.md). Must be exactly 32 bytes
 * once base64-decoded, e.g. `openssl rand -base64 32`.
 */
function loadEncryptionKey(): Buffer {
  const encoded = process.env["BACKUP_ENCRYPTION_KEY"];
  if (!encoded) {
    throw new Error("BACKUP_ENCRYPTION_KEY environment variable is required");
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error(
      `BACKUP_ENCRYPTION_KEY must decode to 32 bytes for AES-256-GCM, got ${String(key.length)}`,
    );
  }
  return key;
}

async function backup(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  const encryptionKey = loadEncryptionKey();

  const backupDir =
    process.env["BACKUP_DIR"] ?? path.resolve(__dirname, "..", "..", "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const filename = `backup-${timestamp}-${randomUUID().slice(0, 8)}.sql.gz.enc`;
  const outputPath = path.join(backupDir, filename);

  const parsed = new URL(connectionString);
  const env = { ...process.env, PGPASSWORD: parsed.password };

  // File layout: [12-byte IV][16-byte GCM auth tag][gzip(pg_dump output) ciphertext]
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const gzip = createGzip();
  const output = fs.createWriteStream(outputPath);

  const proc = execFile(
    "pg_dump",
    [
      "--host",
      parsed.hostname,
      "--port",
      parsed.port || "5432",
      "--username",
      parsed.username || "postgres",
      "--dbname",
      parsed.pathname.replace(/^\//, ""),
      "--format",
      "plain",
      "--verbose",
    ],
    { env },
  );

  let stderr = "";
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  if (!proc.stdout) {
    throw new Error("pg_dump did not provide a stdout stream");
  }

  output.write(iv);
  // Placeholder for the auth tag, patched in after the cipher finishes.
  const authTagPlaceholderOffset = iv.length;
  output.write(Buffer.alloc(16));

  await pipeline(proc.stdout, gzip, cipher, output);

  const exitCode: number = await new Promise((resolve, reject) => {
    proc.on("close", (code) => {
      resolve(code ?? 1);
    });
    proc.on("error", reject);
  });

  if (exitCode !== 0) {
    fs.rmSync(outputPath, { force: true });
    throw new Error(`pg_dump failed (exit ${String(exitCode)}): ${stderr}`);
  }

  const authTag = cipher.getAuthTag();
  const fd = fs.openSync(outputPath, "r+");
  fs.writeSync(fd, authTag, 0, authTag.length, authTagPlaceholderOffset);
  fs.closeSync(fd);

  console.log(`Backup written to ${outputPath} (AES-256-GCM encrypted, gzip compressed)`);
}

void backup();
