import type { SupportedLocale } from "@hourden/domain";
import { createContext, useContext } from "react";

export type LocaleContextValue = {
  locale: SupportedLocale;
  changeLocale: (locale: SupportedLocale) => Promise<void>;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return value;
}
