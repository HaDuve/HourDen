import "../load-env.js";
import { Pool } from "pg";
import { runMigrations } from "./migrate.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://hourden:hourden@localhost:5433/hourden";

const pool = new Pool({ connectionString: databaseUrl });

try {
  await runMigrations(pool);
  console.log("Migrations applied.");
} finally {
  await pool.end();
}
