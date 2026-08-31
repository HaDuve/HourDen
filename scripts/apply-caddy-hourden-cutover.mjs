#!/usr/bin/env node
/**
 * In-place HourDen domain cutover for Portfolio's Caddyfile.
 * Used by scripts/setup-caddy-vm.sh on the VM.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { applyHourdenDomainCutover } from "./caddy-hourden-config.mjs";

const caddyfilePath = process.argv[2];

if (!caddyfilePath) {
  console.error("Usage: apply-caddy-hourden-cutover.mjs <Caddyfile>");
  process.exit(1);
}

const original = readFileSync(caddyfilePath, "utf8");

try {
  const updated = applyHourdenDomainCutover(original);
  if (updated !== original) {
    writeFileSync(caddyfilePath, updated, "utf8");
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
