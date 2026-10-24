import type { ReactNode } from "react";
import { DESKTOP_MEDIA_QUERY } from "../navigation/media-query.js";
import { useMediaQuery } from "../navigation/use-media-query.js";

type PageMainProps = {
  children: ReactNode;
  variant?: "default" | "flex";
  /** Readable column for forms; wide for desktop Tracker (ADR-0015). */
  width?: "readable" | "wide";
  className?: string;
};

export function PageMain({
  children,
  variant = "default",
  width = "readable",
  className = "",
}: PageMainProps) {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const layout = isDesktop ? "desktop" : "mobile";
  const padding = isDesktop ? "px-8 py-8" : "px-4 py-6";
  const variantClasses =
    variant === "flex" ? "flex min-h-screen flex-col gap-6" : "";
  const maxWidth = width === "wide" ? "max-w-6xl" : "max-w-3xl";

  return (
    <main
      data-layout={layout}
      data-width={width}
      className={`mx-auto ${maxWidth} ${padding} ${variantClasses} ${className}`.trim()}
    >
      {children}
    </main>
  );
}
