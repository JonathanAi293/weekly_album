import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin";
import { getImportCatalog, importIssue, parseImportedIssue } from "@/lib/exchange";
import { checkDuplicates, type ImportDecision } from "@/lib/import-dedupe";
import { invalidateIssueData } from "@/lib/cache-invalidation";

export const runtime = "nodejs";

export async function POST(request:Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error:"没有编辑权限。" }, { status:401 });
  let body:{ action?:unknown; raw?:unknown; decisions?:unknown; fingerprint?:unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error:"请求不是有效 JSON。" }, { status:400 }); }
  if (typeof body.raw !== "string" || body.raw.length > 200_000) return NextResponse.json({ error:"请粘贴不超过 200 KB 的 JSON 内容。" }, { status:400 });
  try {
    const payload = parseImportedIssue(body.raw);
    if (body.action === "preview") {
      const catalog = await getImportCatalog(admin.id);
      return NextResponse.json({ ok:true, payload, checks:checkDuplicates(payload.albums, catalog.albums), fingerprint:catalog.fingerprint });
    }
    if (body.action === "confirm") {
      if (typeof body.fingerprint !== "string" || !Array.isArray(body.decisions) || body.decisions.some(d => !d || typeof d !== "object" || !Number.isInteger(d.index) || !["skip", "include"].includes(d.action) || (d.albumId != null && typeof d.albumId !== "string"))) return NextResponse.json({ error:"请先完成检查预览与重复项确认。" }, { status:400 });
      const issueId = await importIssue(admin.id, payload, body.decisions as ImportDecision[], body.fingerprint);
      invalidateIssueData();
      return NextResponse.json({ ok:true, issueId });
    }
    return NextResponse.json({ error:"未知导入操作。" }, { status:400 });
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : "导入内容无法处理。" }, { status:400 }); }
}
