import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.integration.spec.ts"],
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
});
