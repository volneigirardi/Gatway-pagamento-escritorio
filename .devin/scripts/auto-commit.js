import { execFileSync, execSync } from "node:child_process";

const message = process.argv[2];
if (!message || message.trim().length === 0) {
  console.error("Usage: pnpm commit \"<message>\"");
  process.exit(1);
}

const author = execSync('git log --format="%an" -1', { encoding: "utf8" }).trim();
const email = execSync('git log --format="%ae" -1', { encoding: "utf8" }).trim();

execFileSync("git", ["add", "-A"], { stdio: "inherit" });
execFileSync(
  "git",
  [
    "-c",
    `user.name=${author}`,
    "-c",
    `user.email=${email}`,
    "commit",
    "-m",
    message,
  ],
  { stdio: "inherit" },
);
