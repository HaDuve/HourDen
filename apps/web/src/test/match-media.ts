export function createMatchMedia(matches: boolean) {
  return (query: string) => ({
    matches: query.includes("min-width") ? matches : !matches,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
}

export type MatchMediaTestOptions = {
  /** Tailwind `lg` and up when true. */
  wide?: boolean;
  /** `(prefers-reduced-motion: reduce)` matches when true. */
  reducedMotion?: boolean;
};

export function createMatchMediaWithOptions(options: MatchMediaTestOptions) {
  const wide = options.wide ?? false;
  const reducedMotion = options.reducedMotion ?? false;
  return (query: string) => {
    let matches = false;
    if (query.includes("prefers-reduced-motion")) {
      matches = reducedMotion;
    } else if (query.includes("min-width")) {
      matches = wide;
    }
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    };
  };
}
