import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const TEST_TURNSTILE_TOKEN = "test-turnstile-token";

export type TurnstileFieldHandle = {
  reset: () => void;
};

type TurnstileFieldProps = {
  onToken: (token: string) => void;
  onExpire: () => void;
  onUnavailable?: () => void;
};

function readTurnstileSiteKey(): string | undefined {
  const value = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
  return value || undefined;
}

export const TurnstileField = forwardRef<TurnstileFieldHandle, TurnstileFieldProps>(
  function TurnstileField({ onToken, onExpire, onUnavailable }, ref) {
    const turnstileRef = useRef<TurnstileInstance | null>(null);
    const siteKey = readTurnstileSiteKey();
    const isTestBypass = Boolean(import.meta.env.VITEST);
    const isUnavailable = !isTestBypass && !siteKey;

    useImperativeHandle(
      ref,
      () => ({
        reset() {
          if (isTestBypass) {
            onToken(TEST_TURNSTILE_TOKEN);
            return;
          }
          turnstileRef.current?.reset();
        },
      }),
      [isTestBypass, onToken],
    );

    useEffect(() => {
      if (isUnavailable) {
        onUnavailable?.();
        return;
      }
      if (isTestBypass) {
        onToken(TEST_TURNSTILE_TOKEN);
      }
    }, [isTestBypass, isUnavailable, onToken, onUnavailable]);

    if (isUnavailable || isTestBypass) {
      return null;
    }

    return (
      <Turnstile
        ref={turnstileRef}
        siteKey={siteKey!}
        onSuccess={onToken}
        onExpire={() => {
          onExpire();
          turnstileRef.current?.reset();
        }}
      />
    );
  },
);

export { TEST_TURNSTILE_TOKEN };
