import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const imageFormats = {
  "image/jpeg": { extension:"jpg", matches:(bytes:Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension:"png", matches:(bytes:Uint8Array) => bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a },
  "image/webp": { extension:"webp", matches:(bytes:Uint8Array) => bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" },
} as const;

export async function POST(request:Request, { params }: { params:Promise<{ albumId:string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error:"没有编辑权限。" }, { status:401 });

  const { albumId } = await params;
  let formData:FormData;
  try { formData = await request.formData(); } catch { return NextResponse.json({ error:"上传数据无效。" }, { status:400 }); }
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error:"请选择一张图片。" }, { status:400 });
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error:"图片需小于 5MB。" }, { status:400 });
  if (!(file.type in imageFormats)) return NextResponse.json({ error:"仅支持 JPG、PNG 或 WebP 图片。" }, { status:400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = imageFormats[file.type as keyof typeof imageFormats];
  if (!format.matches(bytes)) return NextResponse.json({ error:"图片格式与文件内容不一致，请选择有效的 JPG、PNG 或 WebP 图片。" }, { status:400 });

  const supabase = createAdminClient();
  const { data:album, error:albumError } = await supabase.from("albums").select("id").eq("id", albumId).maybeSingle();
  if (albumError) return NextResponse.json({ error:`无法检查专辑：${albumError.message}` }, { status:500 });
  if (!album) return NextResponse.json({ error:"找不到这张专辑。" }, { status:404 });

  const objectPath = `${albumId}/${crypto.randomUUID()}.${format.extension}`;
  const { error:uploadError } = await supabase.storage.from("album-covers").upload(objectPath, file, { contentType:file.type, cacheControl:"31536000", upsert:false });
  if (uploadError) return NextResponse.json({ error:`无法上传封面：${uploadError.message}` }, { status:500 });

  const { data:publicUrl } = supabase.storage.from("album-covers").getPublicUrl(objectPath);
  const { data, error } = await supabase.from("albums").update({ manual_cover_url:publicUrl.publicUrl }).eq("id", albumId).select("id, manual_cover_url").maybeSingle();
  if (error || !data) {
    await supabase.storage.from("album-covers").remove([objectPath]);
    return NextResponse.json({ error:error ? `无法保存封面：${error.message}` : "找不到这张专辑。" }, { status:error ? 500 : 404 });
  }

  return NextResponse.json({ ok:true, manualCoverUrl:data.manual_cover_url });
}
