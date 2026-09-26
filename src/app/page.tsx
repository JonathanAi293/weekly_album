import Link from "next/link";
import { AlbumCard } from "@/components/AlbumCard";
import { DynamicHomeHero } from "@/components/DynamicHomeHero";
import { FeaturedArtwork } from "@/components/FeaturedArtwork";
import { SiteNav } from "@/components/SiteNav";
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
    </section> : <>
      <article className="featured-issue" aria-labelledby="featured-title">
        <div className="featured-copy">
          <div className="featured-meta"><span>{currentIssue.date}</span><span>Issue {currentIssue.number}</span></div>
          <div className="eyebrow">This week&apos;s featured issue</div>
          <h2 id="featured-title" className="serif">{currentIssue.title}</h2>
          {currentIssue.subtitle && <p className="featured-subtitle">{currentIssue.subtitle}</p>}
          {currentIssue.intro && <p className="featured-intro">{currentIssue.intro}</p>}
          <div className="featured-actions">
            <Link className="featured-link" href={`/issues/${currentIssue.slug}`} prefetch={true}>阅读本期 <span aria-hidden="true">→</span></Link>
            <span className="featured-count">{currentIssue.albums.length} RECORDS</span>
          </div>
        </div>
        <FeaturedArtwork albums={currentIssue.albums} href={`/issues/${currentIssue.slug}`} title={currentIssue.title} />
      </article>

      <section aria-labelledby="albums-heading">
        <div className="section-head">
          <div><div className="eyebrow">Notes from this issue</div><h2 id="albums-heading" className="serif">本期唱片</h2></div>
          <Link className="quiet-link" href={`/issues/${currentIssue.slug}`}>查看完整专栏 →</Link>
        </div>
        <div className="grid">{currentIssue.albums.map(album => <AlbumCard key={album.id} album={album} issueSlug={currentIssue.slug} />)}</div>
        <p className="mobile-note" style={{ marginTop: 22 }}>评分、短评与聆听状态只属于你；需要时可从编辑台导出给 ChatGPT 阅读。</p>
      </section>
    </>}
  </main>;
}
