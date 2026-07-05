import type { ReactNode } from "react";
import { DESKTOP_MEDIA_QUERY } from "../navigation/media-query.js";
import { useMediaQuery } from "../navigation/use-media-query.js";

type PageMainProps = {
  children: ReactNode;
  variant?: "default" | "flex";
  className?: string;
};

export function PageMain({
  children,
  variant = "default",
  className = "",
}: PageMainProps) {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const layout = isDesktop ? "desktop" : "mobile";
  const padding = isDesktop ? "px-8 py-8" : "px-4 py-6";
  const variantClasses =
    variant === "flex" ? "flex min-h-screen flex-col gap-6" : "";

  return (
    <main
      data-layout={layout}
      className={`mx-auto max-w-3xl ${padding} ${variantClasses} ${className}`.trim()}
    >
      {children}
    </main>
  );
}
