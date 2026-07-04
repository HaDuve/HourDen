#!/usr/bin/env node
/**
 * CLI wrapper for production verification (loads env from verify-production.sh).
 */
import { verifyProduction } from "./production-verify.mjs";

const baseUrl = process.env.HOURDEN_BASE_URL ?? "https://hourden.hannesduve.com";
const operatorEmail = process.env.HOURDEN_OPERATOR_EMAIL;
const operatorPassword = process.env.HOURDEN_OPERATOR_PASSWORD;

if (!operatorEmail || !operatorPassword) {
  console.error(
    "Set HOURDEN_OPERATOR_EMAIL and HOURDEN_OPERATOR_PASSWORD (e.g. in .env).",
  );
  process.exit(1);
}

try {
  await verifyProduction({
    baseUrl,
    operatorEmail,
    operatorPassword,
  });
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
