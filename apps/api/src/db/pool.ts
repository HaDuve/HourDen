import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://hourden:hourden@localhost:5433/hourden";

export const pool = new Pool({ connectionString: databaseUrl });
