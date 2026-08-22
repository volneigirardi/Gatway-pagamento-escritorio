import { execFile } from "node:child_process";
import { createDecipheriv } from "node:crypto";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

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

async function restore(backupFile: string): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }
  const encryptionKey = loadEncryptionKey();

  // Layout written by backup.ts: [12-byte IV][ciphertext][16-byte GCM auth tag]
  const fileSize = fs.statSync(backupFile).size;
  const fd = fs.openSync(backupFile, "r");
  const iv = Buffer.alloc(12);
  const authTag = Buffer.alloc(16);
  fs.readSync(fd, iv, 0, 12, 0);
  fs.readSync(fd, authTag, 0, 16, fileSize - 16);
  fs.closeSync(fd);

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
  decipher.setAuthTag(authTag);
  const ciphertextStream = fs.createReadStream(backupFile, {
    start: 12,
    end: fileSize - 16 - 1,
  });
  const gunzip = createGunzip();

  const parsed = new URL(connectionString);
  const env = { ...process.env, PGPASSWORD: parsed.password };

  const proc = execFile(
    "psql",
    [
      "--host",
      parsed.hostname,
      "--port",
      parsed.port || "5432",
      "--username",
      parsed.username || "postgres",
      "--dbname",
      parsed.pathname.replace(/^\//, ""),
      "--set",
      "ON_ERROR_STOP=1",
    ],
    { env },
  );

  let stderr = "";
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  if (!proc.stdin) {
    throw new Error("psql did not provide a stdin stream");
  }

  // Decrypt (auth tag verified on stream end) -> gunzip -> feed into psql.
  await pipeline(ciphertextStream, decipher, gunzip, proc.stdin);

  const exitCode: number = await new Promise((resolve, reject) => {
    proc.on("close", (code) => {
      resolve(code ?? 1);
    });
    proc.on("error", reject);
  });

  if (exitCode !== 0) {
    throw new Error(`Restore failed (exit ${String(exitCode)}): ${stderr}`);
  }

  console.log(`Restore from ${backupFile} completed`);
}

const backupFile = process.argv[2];
if (!backupFile) {
  console.error("Usage: node restore.ts <backup-file>");
  process.exit(1);
}
void restore(backupFile);
