import type { Metadata, Viewport } from "next";
import { AppNavigationTracker } from "@/components/AppNavigationTracker";
import { FeedbackProvider } from "@/components/FeedbackProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { getFeedbackForCurrentUser } from "@/lib/queries";
import { readSiteSettings } from "@/lib/site-settings";
import { resolveSiteTheme, themeCssVariables } from "@/lib/site-theme";
import type { CSSProperties } from "react";
import { auditStep } from "@/lib/perf-audit";
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
  const [initialFeedback, state] = await Promise.all([
    auditStep("layout feedback", getFeedbackForCurrentUser),
    auditStep("layout site settings", readSiteSettings),
  ]);
  const settings = state.settings;
  const theme = resolveSiteTheme({ themeMode:settings.themeMode, presetId:settings.presetId, custom:settings.custom, autoPalette:settings.autoPalette });
  return <html lang="zh-CN" data-scroll-behavior="smooth" style={themeCssVariables(theme) as CSSProperties}><head><meta name="theme-color" content={theme.background} /></head><body><FeedbackProvider initialFeedback={initialFeedback}><AppNavigationTracker />{children}<SiteFooter /></FeedbackProvider></body></html>;
}
