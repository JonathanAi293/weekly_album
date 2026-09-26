import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin";
import { saveSiteSettings, type SiteSettingsDraft } from "@/lib/site-settings";
import { contrastRatio, normalizeHex, THEME_PRESETS, type HeroMode, type ThemeMode, type ThemePresetId } from "@/lib/site-theme";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { invalidateSiteSettings } from "@/lib/cache-invalidation";

export const runtime = "nodejs";

function isPercent(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isOwnedHeroUrl(value: string) {
  try {
    const parsed = new URL(value);
    const project = new URL(getSupabaseConfig().url);
    return parsed.protocol === "https:" && parsed.origin === project.origin && parsed.pathname.startsWith("/storage/v1/object/public/site-assets/hero/") && !parsed.search && !parsed.hash;
  } catch { return false; }
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "没有编辑权限。" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch { return NextResponse.json({ error: "请求内容无效。" }, { status: 400 }); }

  const heroMode = body.heroMode;
  const heroManualUrl = body.heroManualUrl;
  const themeMode = body.themeMode;
  const presetId = body.presetId;
  const customRaw = body.custom;
  const custom = customRaw && typeof customRaw === "object" ? customRaw as Record<string, unknown> : {};
  const background = normalizeHex(custom.background), accent = normalizeHex(custom.accent), text = normalizeHex(custom.text);
  if (heroMode !== "auto" && heroMode !== "manual") return NextResponse.json({ error: "Hero 模式无效。" }, { status: 400 });
  if (heroMode === "manual" && (typeof heroManualUrl !== "string" || !isOwnedHeroUrl(heroManualUrl))) return NextResponse.json({ error: "手动 Hero 必须使用本项目上传的图片。" }, { status: 400 });
  if (heroManualUrl !== null && heroManualUrl !== undefined && (typeof heroManualUrl !== "string" || !isOwnedHeroUrl(heroManualUrl))) return NextResponse.json({ error: "Hero 图片地址无效。" }, { status: 400 });
  if (!["auto", "preset", "custom"].includes(String(themeMode))) return NextResponse.json({ error: "主题模式无效。" }, { status: 400 });
  if (!THEME_PRESETS.some(item => item.id === presetId)) return NextResponse.json({ error: "主题预设无效。" }, { status: 400 });
  if (!background || !accent || !text) return NextResponse.json({ error: "请填写有效的十六进制颜色。" }, { status: 400 });
  if (themeMode === "custom" && (contrastRatio(text, background) < 4.5 || contrastRatio(accent, background) < 4.5)) return NextResponse.json({ error: "正文与强调色需要和背景保持至少 4.5:1 的对比度。" }, { status: 400 });

  const numbers = [body.desktopFocusX, body.desktopFocusY, body.mobileFocusX, body.mobileFocusY];
  if (!numbers.every(isPercent)) return NextResponse.json({ error: "裁切焦点必须在 0 到 100 之间。" }, { status: 400 });

  const draft: SiteSettingsDraft = {
    heroMode: heroMode as HeroMode,
    heroManualUrl: typeof heroManualUrl === "string" ? heroManualUrl : null,
    desktopFocusX: body.desktopFocusX as number,
    desktopFocusY: body.desktopFocusY as number,
    mobileFocusX: body.mobileFocusX as number,
    mobileFocusY: body.mobileFocusY as number,
    themeMode: themeMode as ThemeMode,
    presetId: presetId as ThemePresetId,
    custom: { background, accent, text },
  };

  try {
    await saveSiteSettings(draft);
    invalidateSiteSettings();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "无法保存设置。" }, { status: 500 });
  }
}
