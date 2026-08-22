import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke tests against the built web app, run across the browser matrix
 * required by .devin/rules (Chromium, Firefox, WebKit) and required
 * viewport classes (desktop + mobile). See docs/security/web-security.md
 * and .devin/skills/quality-gate/SKILL.md.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: "http://localhost:3004",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm preview -- --port 3004",
    url: "http://localhost:3004",
    reuseExistingServer: !process.env["CI"],
    timeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
});
