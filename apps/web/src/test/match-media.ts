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
