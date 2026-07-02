import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "@testing-library/jest-dom/vitest";

const root = resolve(fileURLToPath(import.meta.url), "../../../..");
config({ path: resolve(root, ".env") });
