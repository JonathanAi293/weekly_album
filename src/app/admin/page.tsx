import { redirect } from "next/navigation";
import { ImportExportPanel } from "@/components/ImportExportPanel";
import { SiteNav } from "@/components/SiteNav";
import { getCurrentAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  let issues: Array<{ id:string; number:string; title:string; date:string }> = [];
  let configurationError = "";
  try {
    const { data, error } = await createAdminClient().from("issues").select("id, issue_number, title, published_at").eq("status", "published").order("published_at", { ascending:false });
    if (error) throw error;
    issues = (data ?? []).map(issue => ({ id:issue.id, number:`#${String(issue.issue_number).padStart(3, "0")}`, title:issue.title, date:issue.published_at }));
  } catch (error) {
    configurationError = error instanceof Error ? error.message : "编辑台暂时无法读取数据。";
  }
  return <main className="page detail-shell"><SiteNav backHref="/" /><section className="issue-hero"><div className="eyebrow">Private exchange desk</div><h1 className="serif">编辑台</h1><p>这里不生成推荐，也不保存 AI 密钥。它只负责在 ChatGPT 与你的私人唱片库之间，谨慎地交换专栏和反馈。</p></section>{configurationError ? <div className="collection-empty"><span className="record" /><h2 className="serif">编辑台暂不可用。</h2><p>{configurationError}</p></div> : <ImportExportPanel issues={issues} />}</main>;
}
