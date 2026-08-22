import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 3004 },
  preview: { port: 3004 },
  test: {
    // e2e/** uses @playwright/test, run via `pnpm test:e2e`, not Vitest.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
