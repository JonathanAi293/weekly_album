import Link from "next/link";
import { DynamicHomeHero } from "@/components/DynamicHomeHero";
import { SiteNav } from "@/components/SiteNav";
import { WeeklyRecordShelf } from "@/components/WeeklyRecordShelf";
import { getCurrentIssue, getFeedbackForCurrentUser, requireUser } from "@/lib/queries";
import { getSiteAppearance } from "@/lib/site-appearance";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireUser();
  const [currentIssue, feedback] = await Promise.all([getCurrentIssue(), getFeedbackForCurrentUser()]);
  const appearance = await getSiteAppearance(feedback);

  return <main className="page home-page">
    <SiteNav />
    <DynamicHomeHero hero={appearance.hero} fallbackHref={currentIssue ? `/issues/${currentIssue.slug}` : undefined} />

    {!currentIssue ? <section className="home-empty-note">
      <div className="eyebrow">The first issue is yet to arrive</div>
      <p>还没有已发布的专栏。准备好 ChatGPT 生成的 JSON 后，可从编辑台谨慎导入第一期。</p>
      <Link className="quiet-link" href="/admin">前往编辑台 →</Link>
    </section> : <WeeklyRecordShelf issue={currentIssue} />}
  </main>;
}
