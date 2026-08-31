import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useEffect, useRef } from "react";

const TEST_TURNSTILE_TOKEN = "test-turnstile-token";

type TurnstileFieldProps = {
  onToken: (token: string) => void;
  onExpire: () => void;
};

function readTurnstileSiteKey(): string | undefined {
  const value = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
  return value || undefined;
}

export function TurnstileField({ onToken, onExpire }: TurnstileFieldProps) {
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const siteKey = readTurnstileSiteKey();

  useEffect(() => {
    if (import.meta.env.VITEST || !siteKey) {
      onToken(TEST_TURNSTILE_TOKEN);
    }
  }, [onToken, siteKey]);

  if (import.meta.env.VITEST || !siteKey) {
    return null;
  }

  return (
    <Turnstile
      ref={turnstileRef}
      siteKey={siteKey}
      onSuccess={onToken}
      onExpire={() => {
        onExpire();
        turnstileRef.current?.reset();
      }}
    />
  );
}

export { TEST_TURNSTILE_TOKEN };
