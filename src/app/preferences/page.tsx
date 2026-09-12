import { SiteNav } from "@/components/SiteNav";
import { getActivePreferenceProfile, requireUser } from "@/lib/queries";
export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  await requireUser(); const profile = await getActivePreferenceProfile();
  return <main className="page detail-shell"><SiteNav backHref="/" /><section className="issue-hero"><div className="eyebrow">Listening profile</div><h1 className="serif">你的聆听画像</h1><p>由所有真实评分与短评定期浓缩而成。它不是给你贴标签，只是帮下一次相遇更有方向。</p></section>{profile ? <section className="profile" style={{ margin:"28px 0" }}><div className="eyebrow">profile · v{profile.version}</div><h2 className="serif">你的聆听线索正在沉淀。</h2><p className="reason">{profile.profileText ?? "当前画像已保存为结构化资料，等待下一阶段生成可读摘要。"}</p></section> : <div className="collection-empty"><span className="record" /><h2 className="serif">画像还在等待第一批笔记。</h2><p>本阶段已接入画像存储；AI 总结会在后续阶段启用。</p></div>}</main>;
}
