import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*", "scripts"],
    fileParallelism: false,
    maxWorkers: 1,
    globalSetup: ["./apps/api/src/test/global-setup.ts"],
  },
});
