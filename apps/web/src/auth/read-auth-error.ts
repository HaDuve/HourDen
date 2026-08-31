export type AuthFlow = "login" | "signup";

export type AuthErrorMessage =
  | { kind: "i18n"; key: string }
  | { kind: "api"; message: string };

type ApiErrorBody = {
  error?: string;
};

const PASSWORD_VALIDATION_PREFIXES = [
  "Password must be at least",
  "Password must include",
] as const;

function isPasswordValidationError(error: string): boolean {
  return PASSWORD_VALIDATION_PREFIXES.some((prefix) => error.startsWith(prefix));
}

function i18nError(key: string): AuthErrorMessage {
  return { kind: "i18n", key };
}

function toApiError(message: string): AuthErrorMessage {
  return { kind: "api", message };
}

export async function resolveAuthErrorMessage(
  flow: AuthFlow,
  res: Response,
): Promise<AuthErrorMessage> {
  if (res.status === 429) {
    return i18nError("auth.tooManyAttempts");
  }

  let apiErrorMessage: string | undefined;
  try {
    const body = (await res.json()) as ApiErrorBody;
    apiErrorMessage = body.error?.trim();
  } catch {
    // Fall through to generic messages.
  }

  if (flow === "login") {
    return i18nError("login.invalidCredentials");
  }

  if (res.status === 409) {
    return i18nError("signup.failed");
  }

  if (apiErrorMessage === "Verification failed") {
    return i18nError("signup.verificationFailed");
  }

  if (apiErrorMessage && isPasswordValidationError(apiErrorMessage)) {
    return toApiError(apiErrorMessage);
  }

  return i18nError("signup.failed");
}
