#!/usr/bin/env node
/**
 * Post-build smoke: production Node must resolve @hourden/domain and serve /health.
 * Run after `npm run build` (CI and local).
 */
import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { createApp } from "../apps/api/dist/app.js";

const app = createApp();
const res = await app.request("/health");

if (res.status !== 200) {
  console.error(`Expected /health 200, got ${res.status}`);
  process.exit(1);
}

const body = await res.json();

if (body.status !== "ok" || body.workspaceId !== DEFAULT_WORKSPACE_ID) {
  console.error("Unexpected health payload:", body);
  process.exit(1);
}

console.log("verify-built-api: OK");
