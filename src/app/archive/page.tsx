import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { getIssues, requireUser } from "@/lib/queries";
export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  await requireUser(); const issues = await getIssues();
  return <main className="page"><SiteNav backHref="/" /><section className="issue-hero"><div className="eyebrow">Archive</div><h1 className="serif">往期专栏</h1><p>每一期都是某个周五留下的听觉切片。已听过的唱片与当时的感受，会在下一期继续产生回响。</p></section>{issues.length ? <div className="archive-list">{issues.map(issue => <Link href={`/issues/${issue.slug}`} className="archive-row" key={issue.slug}><span className="eyebrow">{issue.number}</span><div><h2 className="serif">{issue.title}</h2><p className="artist">{issue.date} · {issue.albumCount} 张专辑</p></div><span className="quiet-link">打开 →</span></Link>)}</div> : <div className="collection-empty"><span className="record" /><h2 className="serif">还没有往期专栏。</h2><p>发布第一期后，它会被安静地收在这里。</p></div>}</main>;
}
