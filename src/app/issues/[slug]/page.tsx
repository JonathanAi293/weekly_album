import { notFound } from "next/navigation";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { SiteNav } from "@/components/SiteNav";
import { getIssueBySlug, requireUser } from "@/lib/queries";

export default async function IssuePage({ params }: { params: Promise<{ slug: string }> }) {
  await requireUser(); const { slug } = await params; const issue = await getIssueBySlug(slug); if (!issue) notFound();
  return <main className="page detail-shell"><SiteNav backHref="/" /><section className="issue-hero"><div className="eyebrow">{issue.number} · {issue.date}</div><h1 className="serif">{issue.title}</h1>{issue.subtitle && <div className="eyebrow" style={{ marginBottom:10 }}>{issue.subtitle}</div>}<p>{issue.intro}</p></section><section>{issue.albums.map((album, index) => <article className="detail-card" id={album.id} key={album.id}>{album.cover && <img className="cover" src={album.cover} alt={`${album.title} 专辑封面`} />}<div><div className="card-kicker"><span className={`pill ${album.type === "探索推荐" ? "explore" : ""}`}>{album.type}</span><span>{String(index + 1).padStart(2, "0")}</span></div><h2 className="serif">{album.title}</h2><p className="artist">{album.artist} · {album.releaseYear}</p><div className="tags">{album.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div><p className="reason"><b>为什么值得听：</b>{album.reason}</p><p className="review"><b>{album.source}</b><br />{album.review} {album.sourceUrl && <a href={album.sourceUrl} target="_blank" rel="noreferrer">查看来源 ↗</a>}</p><FeedbackPanel albumId={album.id} /></div></article>)}</section></main>;
}
