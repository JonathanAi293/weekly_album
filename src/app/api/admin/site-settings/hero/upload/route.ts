import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin";
import { analyzeStoredImage, validateHeroImageBuffer } from "@/lib/server-image-analysis";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 15;

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const imageFormats = {
  "image/jpeg": { extension: "jpg", matches: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", matches: (bytes: Uint8Array) => bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a },
  "image/webp": { extension: "webp", matches: (bytes: Uint8Array) => bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" },
} as const;

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "没有编辑权限。" }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES + 128 * 1024) return NextResponse.json({ error: "图片需小于 6MB。" }, { status: 413 });

  let formData: FormData;
  try { formData = await request.formData(); } catch { return NextResponse.json({ error: "上传数据无效。" }, { status: 400 }); }
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "请选择一张图片。" }, { status: 400 });
  if (!file.size || file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "图片需小于 6MB。" }, { status: 400 });
  if (!(file.type in imageFormats)) return NextResponse.json({ error: "仅支持 JPG、PNG 或 WebP 图片。" }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = imageFormats[file.type as keyof typeof imageFormats];
  if (!format.matches(bytes)) return NextResponse.json({ error: "图片格式与文件内容不一致，请选择有效的 JPG、PNG 或 WebP 图片。" }, { status: 400 });
  const expectedFormat = file.type === "image/jpeg" ? "jpeg" : file.type === "image/png" ? "png" : "webp";
  if (!await validateHeroImageBuffer(Buffer.from(bytes), expectedFormat)) return NextResponse.json({ error: "图片无法安全解码、尺寸过大，或包含暂不支持的动态帧。" }, { status: 400 });

  const supabase = createAdminClient();
  const objectPath = `hero/${crypto.randomUUID()}.${format.extension}`;
  const { error: uploadError } = await supabase.storage.from("site-assets").upload(objectPath, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (uploadError) return NextResponse.json({ error: `无法上传 Hero 图片：${uploadError.message}` }, { status: 500 });

  const { data } = supabase.storage.from("site-assets").getPublicUrl(objectPath);
  const palette = await analyzeStoredImage(data.publicUrl);
  return NextResponse.json({ ok: true, url: data.publicUrl, palette });
}
