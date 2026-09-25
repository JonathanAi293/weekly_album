import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_COLORS, normalizeHex, type AutoPalette, type HeroMode, type ThemeColors, type ThemeMode, type ThemePresetId } from "./site-theme";

export type SiteSettings = {
  heroMode: HeroMode;
  heroManualUrl: string | null;
  desktopFocusX: number;
  desktopFocusY: number;
  mobileFocusX: number;
  mobileFocusY: number;
  themeMode: ThemeMode;
  presetId: ThemePresetId;
  custom: ThemeColors;
  autoPaletteSource: string | null;
  autoPalette: AutoPalette | null;
};

export type SiteSettingsState = { settings: SiteSettings; ready: boolean; error: string | null };

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  heroMode: "auto",
  heroManualUrl: null,
  desktopFocusX: 50,
  desktopFocusY: 50,
  mobileFocusX: 50,
  mobileFocusY: 50,
  themeMode: "auto",
  presetId: "default",
  custom: DEFAULT_COLORS,
  autoPaletteSource: null,
  autoPalette: null,
};

type SiteSettingsRow = {
  hero_mode: string;
  hero_manual_url: string | null;
  hero_desktop_focus_x: number;
  hero_desktop_focus_y: number;
  hero_mobile_focus_x: number;
  hero_mobile_focus_y: number;
  theme_mode: string;
  preset_id: string;
  custom_background: string;
  custom_accent: string;
  custom_text: string;
  auto_palette_source: string | null;
  auto_palette: unknown;
};

const validPresets: ThemePresetId[] = ["default", "azure-cream", "indigo-sea", "hk-retro"];

export function parseAutoPalette(value: unknown): AutoPalette | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const background = normalizeHex(row.background), accent = normalizeHex(row.accent), text = normalizeHex(row.text);
  const heroTextDesktop = normalizeHex(row.heroTextDesktop), heroTextMobile = normalizeHex(row.heroTextMobile);
  const meanLuminance = Number(row.meanLuminance);
  const heroOverlayDesktop = row.heroOverlayDesktop, heroOverlayMobile = row.heroOverlayMobile;
  const darkOverlay = "linear-gradient(90deg, rgba(0,0,0,.48) 0%, rgba(0,0,0,.28) 42%, rgba(0,0,0,.08) 74%, transparent 100%)";
  const lightOverlay = "linear-gradient(90deg, rgba(255,255,255,.64) 0%, rgba(255,255,255,.38) 42%, rgba(255,255,255,.10) 74%, transparent 100%)";
  const safeOverlays = [darkOverlay, lightOverlay];
  if (!background || !accent || !text || !heroTextDesktop || !heroTextMobile || (heroTextDesktop !== "#FFFFFF" && heroTextDesktop !== "#111214") || (heroTextMobile !== "#FFFFFF" && heroTextMobile !== "#111214") || !Number.isFinite(meanLuminance) || meanLuminance < 0 || meanLuminance > 1 || !safeOverlays.includes(String(heroOverlayDesktop)) || !safeOverlays.includes(String(heroOverlayMobile))) return null;
  return { background, accent, text, heroTextDesktop, heroTextMobile, heroOverlayDesktop: String(heroOverlayDesktop), heroOverlayMobile: String(heroOverlayMobile), meanLuminance };
}

export function mapSiteSettings(row: SiteSettingsRow | null): SiteSettings {
  if (!row) return DEFAULT_SITE_SETTINGS;
  const themeMode: ThemeMode = row.theme_mode === "preset" || row.theme_mode === "custom" ? row.theme_mode : "auto";
  const heroMode: HeroMode = row.hero_mode === "manual" ? "manual" : "auto";
  const presetId = validPresets.find(item => item === row.preset_id) ?? "default";
  return {
    heroMode,
    heroManualUrl: row.hero_manual_url,
    desktopFocusX: clampPercent(row.hero_desktop_focus_x),
    desktopFocusY: clampPercent(row.hero_desktop_focus_y),
    mobileFocusX: clampPercent(row.hero_mobile_focus_x),
    mobileFocusY: clampPercent(row.hero_mobile_focus_y),
    themeMode,
    presetId,
    custom: {
      background: normalizeHex(row.custom_background) ?? DEFAULT_COLORS.background,
      accent: normalizeHex(row.custom_accent) ?? DEFAULT_COLORS.accent,
      text: normalizeHex(row.custom_text) ?? DEFAULT_COLORS.text,
    },
    autoPaletteSource: row.auto_palette_source,
    autoPalette: parseAutoPalette(row.auto_palette),
  };
}

function clampPercent(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 50;
}

export async function readSiteSettings(): Promise<SiteSettingsState> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("site_settings").select("hero_mode, hero_manual_url, hero_desktop_focus_x, hero_desktop_focus_y, hero_mobile_focus_x, hero_mobile_focus_y, theme_mode, preset_id, custom_background, custom_accent, custom_text, auto_palette_source, auto_palette").eq("singleton_id", true).maybeSingle();
    if (error) return { settings: DEFAULT_SITE_SETTINGS, ready: false, error: "设置表尚未就绪。请先执行新的 Supabase migration。" };
    return { settings: mapSiteSettings(data as SiteSettingsRow | null), ready: true, error: null };
  } catch {
    return { settings: DEFAULT_SITE_SETTINGS, ready: false, error: "无法连接设置存储。请检查 SUPABASE_SECRET_KEY 与 migration。" };
  }
}

export type SiteSettingsDraft = Omit<SiteSettings, "autoPaletteSource" | "autoPalette">;

export async function saveSiteSettings(draft: SiteSettingsDraft) {
  const admin = createAdminClient();
  const values = {
    singleton_id: true,
    hero_mode: draft.heroMode,
    hero_manual_url: draft.heroManualUrl,
    hero_desktop_focus_x: draft.desktopFocusX,
    hero_desktop_focus_y: draft.desktopFocusY,
    hero_mobile_focus_x: draft.mobileFocusX,
    hero_mobile_focus_y: draft.mobileFocusY,
    theme_mode: draft.themeMode,
    preset_id: draft.presetId,
    custom_background: draft.custom.background,
    custom_accent: draft.custom.accent,
    custom_text: draft.custom.text,
  };
  const { error } = await admin.from("site_settings").upsert(values, { onConflict: "singleton_id" });
  if (error) throw new Error("保存设置失败。请确认 site_settings migration 已执行。");
}

export async function saveAutoPalette(source: string, palette: AutoPalette) {
  const admin = createAdminClient();
  const { error } = await admin.from("site_settings").update({ auto_palette_source: source, auto_palette: palette }).eq("singleton_id", true);
  if (error) throw new Error("无法缓存自动配色。");
}
