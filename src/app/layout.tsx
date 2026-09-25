import type { Metadata, Viewport } from "next";
import { AppNavigationTracker } from "@/components/AppNavigationTracker";
import { FeedbackProvider } from "@/components/FeedbackProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { getFeedbackForCurrentUser } from "@/lib/queries";
import "./globals.css";

export const metadata: Metadata = {
  title: "周五唱片室",
  description: "为一个人策划的每周专辑推荐专栏。",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "周五唱片室", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#111214", viewportFit: "cover" };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const initialFeedback = await getFeedbackForCurrentUser();
  return <html lang="zh-CN"><body><FeedbackProvider initialFeedback={initialFeedback}><AppNavigationTracker />{children}<SiteFooter /></FeedbackProvider></body></html>;
}
