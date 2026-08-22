import { execFile } from "node:child_process";
import fs from "node:fs";

async function restore(backupFile: string): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }

  const parsed = new URL(connectionString);
  const env = { ...process.env, PGPASSWORD: parsed.password };

  await new Promise<void>((resolve, reject) => {
    execFile(
      "psql",
      [
        "--host",
        parsed.hostname,
        "--port",
        parsed.port || "5432",
        "--username",
        parsed.username || "postgres",
        "--dbname",
        parsed.pathname?.replace(/^\//, "") || "",
        "--file",
        backupFile,
        "--set",
        "ON_ERROR_STOP=1",
      ],
      { env },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`Restore failed: ${stderr}`));
        } else {
          resolve();
        }
      },
    );
  });

  console.log(`Restore from ${backupFile} completed`);
}

const backupFile = process.argv[2];
if (!backupFile) {
  console.error("Usage: tsx restore.ts <backup-file>");
  process.exit(1);
}
void restore(backupFile);
