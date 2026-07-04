import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export type PasswordValidation =
  | { ok: true }
  | { ok: false; error: string };

export function validatePassword(password: string): PasswordValidation {
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, error: "Password must include an uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, error: "Password must include a lowercase letter" };
  }
  if (!/\d/.test(password)) {
    return { ok: false, error: "Password must include a digit" };
  }
  return { ok: true };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer;

  return (
    expected.length === derived.length &&
    timingSafeEqual(expected, derived)
  );
}
