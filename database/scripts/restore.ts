import { execFile } from "node:child_process";
import { createDecipheriv } from "node:crypto";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";

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

/**
 * Decrypts and decompresses the whole backup file into memory before
 * returning. This is intentional: GCM only verifies its auth tag once all
 * ciphertext has been processed (`decipher.final()`), so streaming
 * decrypted-but-unverified plaintext directly into `psql` would let a
 * corrupted or tampered backup partially execute before the integrity
 * failure is detected. Buffering first means a tampered backup throws
 * before a single statement reaches the database. See the equivalent
 * trade-off note in backup.ts.
 */
function decryptBackup(backupFile: string, encryptionKey: Buffer): Buffer {
  const fileSize = fs.statSync(backupFile).size;
  const raw = fs.readFileSync(backupFile);
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(fileSize - 16);
  const ciphertext = raw.subarray(12, fileSize - 16);

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
  decipher.setAuthTag(authTag);
  const compressed = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return gunzipSync(compressed);
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
  const sql = decryptBackup(backupFile, encryptionKey);

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
  proc.stdin.end(sql);

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
