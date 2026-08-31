import {
  createSlidingWindowLimiter,
  type SlidingWindowConfig,
  type SlidingWindowLimiter,
} from "./sliding-window-limiter.js";
import { createTurnstileVerifier } from "./turnstile.js";

export type AuthRateLimitConfig = {
  registerIp: SlidingWindowConfig;
  registerEmail: SlidingWindowConfig;
  loginIp: SlidingWindowConfig;
};

export type AuthRateLimiters = {
  registerIp: SlidingWindowLimiter;
  registerEmail: SlidingWindowLimiter;
  loginIp: SlidingWindowLimiter;
};

export const DEFAULT_AUTH_RATE_LIMITS: AuthRateLimitConfig = {
  registerIp: { limit: 5, windowMs: 60 * 60 * 1000 },
  registerEmail: { limit: 3, windowMs: 24 * 60 * 60 * 1000 },
  loginIp: { limit: 20, windowMs: 15 * 60 * 1000 },
};

export function createAuthRateLimiters(
  config: AuthRateLimitConfig = DEFAULT_AUTH_RATE_LIMITS,
): AuthRateLimiters {
  return {
    registerIp: createSlidingWindowLimiter(config.registerIp),
    registerEmail: createSlidingWindowLimiter(config.registerEmail),
    loginIp: createSlidingWindowLimiter(config.loginIp),
  };
}

export type AuthProtectionOptions = {
  verifyTurnstile?: (token: string, remoteIp: string) => Promise<boolean>;
  rateLimiters?: AuthRateLimiters | null;
};

export function resolveAuthProtection(
  options: AuthProtectionOptions = {},
): Required<Pick<AuthProtectionOptions, "verifyTurnstile">> & {
  rateLimiters: AuthRateLimiters | null;
} {
  return {
    verifyTurnstile:
      options.verifyTurnstile ??
      createTurnstileVerifier(process.env.TURNSTILE_SECRET_KEY),
    rateLimiters:
      options.rateLimiters === undefined
        ? createAuthRateLimiters()
        : options.rateLimiters,
  };
}
