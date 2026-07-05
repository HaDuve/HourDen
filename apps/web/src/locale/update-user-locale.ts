import type { SupportedLocale } from "@hourden/domain";
import { applyLocale } from "../i18n/i18n.js";
import { writeStoredLocale } from "./storage.js";

export async function updateUserLocale(locale: SupportedLocale): Promise<void> {
  const res = await fetch("/api/auth/locale", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });

  if (!res.ok) {
    throw new Error(`Failed to update locale (${res.status})`);
  }

  writeStoredLocale(locale);
  await applyLocale(locale);
}
