import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 3004,
    proxy: {
      "/api": { target: "http://127.0.0.1:3000", changeOrigin: false },
      "/socket.io": {
        target: "ws://127.0.0.1:3002",
        changeOrigin: false,
        ws: true,
      },
    },
  },
  preview: { port: 3004 },
  test: {
    // e2e/** uses @playwright/test, run via `pnpm test:e2e`, not Vitest.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
