import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin";
import { getEditorialWorkspace,previewEditorial,saveEditorial,editEditorial } from "@/lib/editorial";
import { invalidateIssueData } from "@/lib/cache-invalidation";
import type { ImportDecision } from "@/lib/import-dedupe";
export const runtime="nodejs";
export async function GET() {
  if (!await getCurrentAdmin()) return NextResponse.json({error:"没有编辑权限。"},{status:401});
  try { return NextResponse.json(await getEditorialWorkspace(),{headers:{"Cache-Control":"private, no-store"}}); }
  catch(error) {return NextResponse.json({error:error instanceof Error?error.message:"无法读取资料。"},{status:500});}
}
export async function POST(request:Request) {
  const admin=await getCurrentAdmin();
  if(!admin) return NextResponse.json({error:"没有编辑权限。"},{status:401});
  try {
    const text=await request.text();
    if(text.length>250_000) throw new Error("内容过大，请分批保存。");
    const body=JSON.parse(text);
    if(body.action==="edit") {
      if(!["issue","album","recommendation"].includes(body.kind)||typeof body.id!=="string"||typeof body.version!=="string") throw new Error("编辑请求无效。");
      await editEditorial(body.kind,body.id,body.version,body.value);
      invalidateIssueData(); return NextResponse.json({ok:true});
    }
    if(!["create","append"].includes(body.mode)||typeof body.raw!=="string"||body.raw.length>200_000) throw new Error("导入模式或内容无效。");
    if(body.issueId!=null && typeof body.issueId!=="string") throw new Error("期数无效。");
    if(body.action==="preview") return NextResponse.json(await previewEditorial(admin.id,body.mode,body.raw,body.issueId));
    if(body.action!=="confirm"||typeof body.fingerprint!=="string"||!Array.isArray(body.decisions)||body.decisions.some((d:ImportDecision)=>!d||typeof d!=="object"||!Number.isInteger(d.index)||!["skip","include"].includes(d.action)||(d.albumId!=null&&typeof d.albumId!=="string"))) throw new Error("请先预览并处理重复项。");
    const result=await saveEditorial(admin.id,body.mode,body.raw,body.issueId,body.decisions,body.fingerprint,body.issueVersion);
    invalidateIssueData(); return NextResponse.json({ok:true,...result});
  } catch(error) {return NextResponse.json({error:error instanceof Error?error.message:"无法保存。"},{status:400});}
}
