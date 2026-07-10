import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    conditions: ["development", "import", "module", "browser", "default"],
    alias: {
      "lucide-react/icons": fileURLToPath(
        new URL("../../node_modules/lucide-react/dist/esm/icons", import.meta.url),
      ),
    },
  },
  test: {
    name: "web-unit",
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    include: ["src/**/*.test.{ts,tsx,mjs}"],
    exclude: ["src/**/*.integration.test.{ts,tsx}"],
    sequence: {
      groupOrder: 0,
    },
  },
});
