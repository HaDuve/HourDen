export type AuthFlow = "login" | "signup";

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

export async function resolveAuthErrorMessage(
  flow: AuthFlow,
  res: Response,
): Promise<string> {
  if (res.status === 429) {
    return "auth.tooManyAttempts";
  }

  let apiError: string | undefined;
  try {
    const body = (await res.json()) as ApiErrorBody;
    apiError = body.error?.trim();
  } catch {
    // Fall through to generic messages.
  }

  if (flow === "login") {
    return "login.invalidCredentials";
  }

  if (res.status === 409) {
    return "signup.failed";
  }

  if (apiError === "Verification failed") {
    return "signup.verificationFailed";
  }

  if (apiError && isPasswordValidationError(apiError)) {
    return apiError;
  }

  return "signup.failed";
}
