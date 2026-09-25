import type { Metadata, Viewport } from "next";
import { AppNavigationTracker } from "@/components/AppNavigationTracker";
import { FeedbackProvider } from "@/components/FeedbackProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { getFeedbackForCurrentUser } from "@/lib/queries";
import { getSiteAppearance } from "@/lib/site-appearance";
import type { CSSProperties } from "react";
import { SiteAppearanceProvider } from "@/components/SiteAppearanceProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "周五唱片室",
  description: "为一个人策划的每周专辑推荐专栏。",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "周五唱片室", statusBarStyle: "default" },
};

export const viewport: Viewport = { viewportFit: "cover" };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const initialFeedback = await getFeedbackForCurrentUser();
  const appearance = await getSiteAppearance(initialFeedback);
  const clientAppearance = { hero: appearance.hero, theme: appearance.theme };
  return <html lang="zh-CN" style={appearance.cssVariables as CSSProperties}><head><meta name="theme-color" content={appearance.theme.background} /></head><body><SiteAppearanceProvider appearance={clientAppearance}><FeedbackProvider initialFeedback={initialFeedback}><AppNavigationTracker />{children}<SiteFooter /></FeedbackProvider></SiteAppearanceProvider></body></html>;
}
