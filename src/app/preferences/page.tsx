import { SiteNav } from "@/components/SiteNav";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";
import { getActivePreferenceProfile, requireUser } from "@/lib/queries";
export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  await requireUser(); const profile = await getActivePreferenceProfile();
  return <main className="page detail-shell"><SiteNav backHref="/" /><section className="issue-hero"><div className="eyebrow">Listening profile</div><h1 className="serif">你的聆听画像</h1><p>由真实评分与短评慢慢沉淀。需要更新它时，从编辑台导出反馈，交给你正在使用的 ChatGPT 对话整理。</p></section>{profile ? <section className="profile" style={{ margin:"28px 0" }}><div className="eyebrow">profile · v{profile.version}</div><h2 className="serif">你的聆听线索正在沉淀。</h2><p className="reason">{profile.profileText ?? "当前画像已保存为结构化资料。"}</p></section> : <div className="collection-empty"><span className="record" /><h2 className="serif">画像还在等待第一批笔记。</h2><p>先留下真实的评分和短评；需要时可以将它们导出，交由 ChatGPT 在对话外整理。</p></div>}<p className="mobile-note"><Link className="quiet-link" href="/admin">前往编辑台，导入专栏或导出反馈 →</Link></p><div className="account-actions"><SignOutButton /></div></main>;
}
