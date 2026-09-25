import { redirect } from "next/navigation";
import { SiteNav } from "@/components/SiteNav";
import { SiteSettingsEditor } from "@/components/SiteSettingsEditor";
import { getCurrentAdmin } from "@/lib/admin";
import { getFeedbackForCurrentUser } from "@/lib/queries";
import { getSiteAppearance } from "@/lib/site-appearance";
import { analyzeStoredImage } from "@/lib/server-image-analysis";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  const feedback = await getFeedbackForCurrentUser();
  const appearance = await getSiteAppearance(feedback);
  const autoHero = appearance.hero.source === "auto" ? appearance.hero.album : appearance.hero.autoAlbum;
  const autoPalette = appearance.hero.source === "auto" ? appearance.hero.palette : autoHero?.imageUrl ? await analyzeStoredImage(autoHero.imageUrl) : null;
  const manualPalette = appearance.hero.source === "manual" ? appearance.hero.palette : appearance.settings.heroManualUrl ? await analyzeStoredImage(appearance.settings.heroManualUrl) : null;

  return <main className="page"><SiteNav backHref="/" /><section className="issue-hero settings-page-heading"><div className="eyebrow">A room of your own</div><h1 className="serif">网站设置</h1><p>调整唱片室的开场画面与纸张色调。设置只影响你的私人阅读空间。</p></section><SiteSettingsEditor settings={appearance.settings} settingsReady={appearance.settingsReady} settingsError={appearance.settingsError} autoHero={autoHero} autoPalette={autoPalette} manualPalette={manualPalette} /></main>;
}
