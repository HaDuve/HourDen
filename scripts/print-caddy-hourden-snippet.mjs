#!/usr/bin/env node
import { buildHourdenCaddySnippet } from "./caddy-hourden-config.mjs";

process.stdout.write(buildHourdenCaddySnippet());
