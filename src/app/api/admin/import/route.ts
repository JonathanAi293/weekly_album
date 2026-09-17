import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin";
import { importIssue, parseImportedIssue } from "@/lib/exchange";

export const runtime = "nodejs";

export async function POST(request:Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error:"没有编辑权限。" }, { status:401 });
  let body:{ action?:unknown; raw?:unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error:"请求不是有效 JSON。" }, { status:400 }); }
  if (typeof body.raw !== "string" || body.raw.length > 200_000) return NextResponse.json({ error:"请粘贴不超过 200 KB 的 JSON 内容。" }, { status:400 });
  try {
    const payload = parseImportedIssue(body.raw);
    if (body.action === "preview") return NextResponse.json({ ok:true, payload });
    if (body.action === "confirm") return NextResponse.json({ ok:true, issueId:await importIssue(admin.id, payload) });
    return NextResponse.json({ error:"未知导入操作。" }, { status:400 });
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : "导入内容无法处理。" }, { status:400 }); }
}
