import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.integration.spec.ts"],
    hookTimeout: 120_000,
    testTimeout: 120_000,
  },
});
