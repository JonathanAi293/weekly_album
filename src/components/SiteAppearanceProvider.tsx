"use client";

import { createContext, useContext } from "react";
import type { SiteHero } from "@/lib/site-appearance";
import type { ResolvedSiteTheme } from "@/lib/site-theme";

type ClientAppearance = { hero: SiteHero; theme: ResolvedSiteTheme };
const SiteAppearanceContext = createContext<ClientAppearance | null>(null);

export function SiteAppearanceProvider({ children, appearance }: { children: React.ReactNode; appearance: ClientAppearance }) {
  return <SiteAppearanceContext.Provider value={appearance}>{children}</SiteAppearanceContext.Provider>;
}

export function useSiteAppearance() {
  const appearance = useContext(SiteAppearanceContext);
  if (!appearance) throw new Error("useSiteAppearance must be used inside SiteAppearanceProvider");
  return appearance;
}
