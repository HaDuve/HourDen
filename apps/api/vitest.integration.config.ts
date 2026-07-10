import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "api-integration",
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    sequence: {
      groupOrder: 1,
    },
  },
});
