import { redirect } from "next/navigation";
import { SiteNav } from "@/components/SiteNav";
import { SiteSettingsEditor } from "@/components/SiteSettingsEditor";
import { getCurrentAdminForPage } from "@/lib/admin";
import { getFeedbackForCurrentUser } from "@/lib/queries";
import { getSiteAppearance } from "@/lib/site-appearance";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const admin = await getCurrentAdminForPage();
  if (!admin) redirect("/login");
  const feedback = await getFeedbackForCurrentUser();
  const appearance = await getSiteAppearance(feedback);
  const autoHero = appearance.hero.source === "auto" ? appearance.hero.album : appearance.hero.autoAlbum;
  const autoPalette = autoHero?.imageUrl === appearance.settings.autoPaletteSource ? appearance.settings.autoPalette : null;
  const manualPalette = appearance.settings.heroManualUrl === appearance.settings.autoPaletteSource ? appearance.settings.autoPalette : null;

  return <main className="page"><SiteNav backHref="/" /><section className="issue-hero settings-page-heading"><div className="eyebrow">A room of your own</div><h1 className="serif">网站设置</h1><p>调整唱片室的开场画面与纸张色调。设置只影响你的私人阅读空间。</p></section><SiteSettingsEditor settings={appearance.settings} settingsReady={appearance.settingsReady} settingsError={appearance.settingsError} autoHero={autoHero} autoPalette={autoPalette} manualPalette={manualPalette} /></main>;
}
