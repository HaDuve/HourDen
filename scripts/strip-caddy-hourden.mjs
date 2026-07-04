#!/usr/bin/env node
/**
 * In-place strip of HourDen edge basic_auth from a Caddyfile (ADR-0009).
 * Used by scripts/fix-caddy-vm.sh on the VM (/opt/HourDen).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { stripHourdenBasicAuth } from "./caddy-hourden-config.mjs";

const caddyfilePath = process.argv[2];

if (!caddyfilePath) {
  console.error("Usage: strip-caddy-hourden.mjs <Caddyfile>");
  process.exit(1);
}

const original = readFileSync(caddyfilePath, "utf8");
const updated = stripHourdenBasicAuth(original);

if (updated !== original) {
  writeFileSync(caddyfilePath, updated, "utf8");
}
