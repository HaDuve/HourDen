import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

type PrototypeSwitcherProps = {
  variants: readonly string[];
  labels?: Record<string, string>;
};

/** Throwaway UI-prototype control for `/prototype`. */
export function PrototypeSwitcher({ variants, labels = {} }: PrototypeSwitcherProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const current = searchParams.get("variant") ?? variants[0] ?? "A";
  const variantsRef = useRef(variants);
  variantsRef.current = variants;
  const currentRef = useRef(current);
  currentRef.current = current;
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const go = useCallback(
    (delta: number) => {
      const list = variantsRef.current;
      const cur = currentRef.current;
      const idx = Math.max(0, list.indexOf(cur));
      const next = list[(idx + delta + list.length) % list.length]!;
      const nextParams = new URLSearchParams(searchParamsRef.current);
      nextParams.set("variant", next);
      setSearchParams(nextParams, { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const label = labels[current] ? `${current} — ${labels[current]}` : current;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full border border-divider bg-content px-3 py-2 text-sm text-background shadow-lg"
      role="group"
      aria-label="Prototype variant switcher"
    >
      <button
        type="button"
        className="rounded-full px-2 py-1 hover:bg-background/20"
        onClick={() => go(-1)}
        aria-label="Previous variant"
      >
        ←
      </button>
      <span className="min-w-[14rem] text-center font-medium">{label}</span>
      <button
        type="button"
        className="rounded-full px-2 py-1 hover:bg-background/20"
        onClick={() => go(1)}
        aria-label="Next variant"
      >
        →
      </button>
    </div>
  );
}
