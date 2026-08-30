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

function parseMinWidthPx(query: string): number | null {
  const match = query.match(/\(min-width:\s*(\d+)px\)/);
  return match ? Number(match[1]) : null;
}

/** `matches` is true when the query's min-width is at or below `minWidthPx`. */
export function createMatchMediaAtMinWidth(minWidthPx: number) {
  return (query: string) => {
    const queryMin = parseMinWidthPx(query);
    const matches =
      queryMin === null
        ? query.includes("min-width")
        : minWidthPx >= queryMin;
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
