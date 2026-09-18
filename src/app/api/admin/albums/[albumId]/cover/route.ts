import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin";
import { isSafeCoverUrl } from "@/lib/cover";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request:Request, { params }: { params:Promise<{ albumId:string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error:"没有编辑权限。" }, { status:401 });
  const { albumId } = await params;
  let body:{ manualCoverUrl?:unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error:"请求不是有效 JSON。" }, { status:400 }); }
  const manualCoverUrl = body.manualCoverUrl === null ? null : typeof body.manualCoverUrl === "string" ? body.manualCoverUrl.trim() : undefined;
  if (manualCoverUrl === undefined || (manualCoverUrl !== null && !isSafeCoverUrl(manualCoverUrl))) return NextResponse.json({ error:"封面 URL 必须是有效的 HTTPS 图片地址。" }, { status:400 });
  const { data, error } = await createAdminClient().from("albums").update({ manual_cover_url:manualCoverUrl || null }).eq("id", albumId).select("id, manual_cover_url").maybeSingle();
  if (error) return NextResponse.json({ error:`无法保存封面：${error.message}` }, { status:500 });
  if (!data) return NextResponse.json({ error:"找不到这张专辑。" }, { status:404 });
  return NextResponse.json({ ok:true, manualCoverUrl:data.manual_cover_url });
}
