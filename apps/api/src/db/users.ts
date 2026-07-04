import type { SupportedLocale } from "@hourden/domain";
import type { Pool } from "pg";

export async function updateUserLocale(
  pool: Pool,
  userId: string,
  locale: SupportedLocale,
): Promise<SupportedLocale> {
  const result = await pool.query<{ locale: SupportedLocale }>(
    `
      UPDATE users
      SET locale = $2
      WHERE id = $1
      RETURNING locale
    `,
    [userId, locale],
  );
  return result.rows[0]!.locale;
}

export async function findUserIdBySessionId(
  pool: Pool,
  sessionId: string,
): Promise<string | null> {
  const result = await pool.query<{ user_id: string }>(
    "SELECT user_id FROM sessions WHERE id = $1",
    [sessionId],
  );
  return result.rows[0]?.user_id ?? null;
}
