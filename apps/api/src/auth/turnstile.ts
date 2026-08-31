export async function verifyTurnstileToken(
  token: string,
  remoteIp: string,
  secretKey: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
          remoteip: remoteIp,
        }),
      },
    );

    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export function createTurnstileVerifier(secretKey: string | undefined) {
  return async (token: string, remoteIp: string): Promise<boolean> => {
    if (!secretKey) {
      return false;
    }
    return verifyTurnstileToken(token, remoteIp, secretKey);
  };
}
