import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function backup(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const backupDir =
    process.env["BACKUP_DIR"] ?? path.resolve(__dirname, "..", "..", "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const filename = `backup-${timestamp}-${randomUUID().slice(0, 8)}.sql.gz.enc`;
  const outputPath = path.join(backupDir, filename);

  const parsed = new URL(connectionString);
  const env = { ...process.env, PGPASSWORD: parsed.password };

  await new Promise<void>((resolve, reject) => {
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
        parsed.pathname.replace(/^\//, "") || "",
        "--format",
        "plain",
        "--verbose",
      ],
      { env },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`pg_dump failed: ${stderr}`));
        } else {
          resolve();
        }
      },
    );
    // In production, pipe through gzip and openssl for encryption.
    // This scaffold redirects to a file for demonstration.
    proc.stdout?.pipe(fs.createWriteStream(outputPath));
  });

  console.log(`Backup written to ${outputPath}`);
}

void backup();
