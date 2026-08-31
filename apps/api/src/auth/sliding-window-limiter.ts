export type SlidingWindowConfig = {
  limit: number;
  windowMs: number;
};

export type SlidingWindowLimiter = {
  tryConsume(key: string): boolean;
};

export function createSlidingWindowLimiter(
  config: SlidingWindowConfig,
): SlidingWindowLimiter {
  const hits = new Map<string, number[]>();

  function prune(key: string, now: number): number[] {
    const windowStart = now - config.windowMs;
    const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
    hits.set(key, timestamps);
    return timestamps;
  }

  return {
    tryConsume(key: string): boolean {
      const now = Date.now();
      const timestamps = prune(key, now);
      if (timestamps.length >= config.limit) {
        return false;
      }
      timestamps.push(now);
      hits.set(key, timestamps);
      return true;
    },
  };
}
