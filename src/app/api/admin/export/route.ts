import { NextResponse } from "next/server";
import { confirmExport, getExportPreview, getLatestExport, type ExportMode, type ExportPreview } from "@/lib/exchange";
import { getCurrentAdmin } from "@/lib/admin";

export const runtime = "nodejs";

function previewFromBody(value:unknown): ExportPreview {
  if (!value || typeof value !== "object") throw new Error("缺少导出预览。");
  const item = value as Partial<ExportPreview>;
  if ((item.mode !== "issue" && item.mode !== "changes") || typeof item.content !== "string" || !Array.isArray(item.items)) throw new Error("导出预览格式无效。");
  return { mode:item.mode, issueId:typeof item.issueId === "string" ? item.issueId : null, content:item.content, count:Number(item.count) || 0, items:item.items.filter((row): row is { id:string; updatedAt:string } => Boolean(row) && typeof row.id === "string" && typeof row.updatedAt === "string") };
}

export async function POST(request:Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error:"没有编辑权限。" }, { status:401 });
  let body:{ action?:unknown; mode?:unknown; issueId?:unknown; preview?:unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error:"请求不是有效 JSON。" }, { status:400 }); }
  try {
    if (body.action === "latest") return NextResponse.json({ ok:true, content:await getLatestExport(admin.id) });
    if (body.action === "preview") {
      if (body.mode !== "issue" && body.mode !== "changes") throw new Error("请选择导出范围。");
      const preview = await getExportPreview(admin.id, body.mode as ExportMode, typeof body.issueId === "string" ? body.issueId : null);
      return NextResponse.json({ ok:true, preview });
    }
    if (body.action === "confirm") return NextResponse.json({ ok:true, runId:await confirmExport(admin.id, previewFromBody(body.preview)) });
    throw new Error("未知导出操作。");
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : "导出操作失败。" }, { status:400 }); }
}
