export type ThemeMode = "auto" | "preset" | "custom";
export type HeroMode = "auto" | "manual";
export type ThemePresetId = "default" | "azure-cream" | "indigo-sea" | "hk-retro";

export type ThemeColors = { background: string; accent: string; text: string };
export type AutoPalette = ThemeColors & {
  heroTextDesktop: string;
  heroTextMobile: string;
  heroOverlayDesktop: string;
  heroOverlayMobile: string;
  meanLuminance: number;
};

export const THEME_PRESETS: Array<{ id: ThemePresetId; name: string; english: string; colors: ThemeColors }> = [
  { id: "default", name: "Massively 黑白", english: "DEFAULT EDITORIAL", colors: { background: "#FFFFFF", accent: "#A64E37", text: "#17181A" } },
  { id: "azure-cream", name: "苍蓝奶霜", english: "AZURE CREAM", colors: { background: "#FAE1D9", accent: "#134857", text: "#28323B" } },
  { id: "indigo-sea", name: "薄群青 · 深海", english: "INDIGO SEA", colors: { background: "#F2F5FA", accent: "#315F9A", text: "#172937" } },
  { id: "hk-retro", name: "港式复古", english: "HONG KONG RETRO", colors: { background: "#FED3A8", accent: "#9D1E31", text: "#195A56" } },
];

export const DEFAULT_COLORS = THEME_PRESETS[0].colors;

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1].length === 3 ? [...match[1]].map(char => `${char}${char}`).join("") : match[1];
  return `#${hex.toUpperCase()}`;
}

function toRgb(hex: string) {
  const normalized = normalizeHex(hex) ?? "#000000";
  return { r: parseInt(normalized.slice(1, 3), 16), g: parseInt(normalized.slice(3, 5), 16), b: parseInt(normalized.slice(5, 7), 16) };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map(value => Math.round(clamp(value / 255) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function relativeLuminance(hex: string) {
  const channels = Object.values(toRgb(hex)).map(value => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(first: string, second: string) {
  const values = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function rgbToHsl(hex: string) {
  const { r: rr, g: gg, b: bb } = toRgb(hex);
  const r = rr / 255, g = gg / 255, b = bb / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = ((h * 60) + 360) % 360;
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const section = h / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  let rgb: [number, number, number];
  if (section < 1) rgb = [chroma, x, 0];
  else if (section < 2) rgb = [x, chroma, 0];
  else if (section < 3) rgb = [0, chroma, x];
  else if (section < 4) rgb = [0, x, chroma];
  else if (section < 5) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];
  const m = l - chroma / 2;
  return toHex({ r: (rgb[0] + m) * 255, g: (rgb[1] + m) * 255, b: (rgb[2] + m) * 255 });
}

function mix(first: string, second: string, amount: number) {
  const a = toRgb(first), b = toRgb(second), t = clamp(amount);
  return toHex({ r: a.r * (1 - t) + b.r * t, g: a.g * (1 - t) + b.g * t, b: a.b * (1 - t) + b.b * t });
}

/** Move only lightness, preserving the chosen hue, until the color meets the requested WCAG contrast. */
export function optimizeContrast(foreground: string, background: string, minimum = 4.5) {
  const source = normalizeHex(foreground) ?? "#17181A";
  const bg = normalizeHex(background) ?? "#FFFFFF";
  if (contrastRatio(source, bg) >= minimum) return source;
  const { h, s, l } = rgbToHsl(source);
  const candidates: Array<{ color: string; distance: number }> = [];
  for (let step = 0; step <= 100; step += 1) {
    const nextLightness = step / 100;
    const color = hslToHex(h, Math.max(s, 0.12), nextLightness);
    if (contrastRatio(color, bg) >= minimum) candidates.push({ color, distance: Math.abs(nextLightness - l) });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0]?.color ?? (contrastRatio("#000000", bg) >= contrastRatio("#FFFFFF", bg) ? "#000000" : "#FFFFFF");
}

export function getHeroTextTreatment(pixels: Uint8Array, width: number, height: number) {
  if (!pixels.length || width < 1 || height < 1) return { text: "#FFFFFF", overlay: "linear-gradient(90deg, rgba(0,0,0,.42), rgba(0,0,0,.12) 58%, transparent 82%)" };
  const values: number[] = [];
  const regionWidth = Math.max(1, Math.floor(width * 0.76));
  const regionHeight = Math.max(1, Math.floor(height * 0.84));
  for (let y = 0; y < regionHeight; y += 1) {
    for (let x = 0; x < regionWidth; x += 1) {
      const offset = (y * width + x) * 3;
      const color = toHex({ r: pixels[offset], g: pixels[offset + 1], b: pixels[offset + 2] });
      values.push(relativeLuminance(color));
    }
  }
  values.sort((a, b) => a - b);
  const upperQuartile = values[Math.floor((values.length - 1) * 0.75)] ?? 0;
  const text = upperQuartile >= 0.46 ? "#111214" : "#FFFFFF";
  const overlay = text === "#FFFFFF"
    ? "linear-gradient(90deg, rgba(0,0,0,.48) 0%, rgba(0,0,0,.28) 42%, rgba(0,0,0,.08) 74%, transparent 100%)"
    : "linear-gradient(90deg, rgba(255,255,255,.64) 0%, rgba(255,255,255,.38) 42%, rgba(255,255,255,.10) 74%, transparent 100%)";
  return { text, overlay };
}

/** Derive a quiet, low-saturation site palette from sampled RGB pixels, not a raw dominant-color swatch. */
export function deriveAutoPalette(pixels: Uint8Array, width: number, height: number, desktop: Uint8Array, desktopWidth: number, desktopHeight: number, mobile: Uint8Array, mobileWidth: number, mobileHeight: number): AutoPalette {
  const bins = new Array(24).fill(0) as number[];
  let totalLuminance = 0, totalSaturation = 0, samples = 0;
  for (let offset = 0; offset + 2 < pixels.length; offset += 3) {
    const color = toHex({ r: pixels[offset], g: pixels[offset + 1], b: pixels[offset + 2] });
    const luminance = relativeLuminance(color);
    const { h, s } = rgbToHsl(color);
    totalLuminance += luminance;
    totalSaturation += s;
    samples += 1;
    if (s > 0.12 && luminance > 0.04 && luminance < 0.94) bins[Math.floor(h / 15) % bins.length] += s * (0.4 + Math.min(luminance, 1 - luminance));
  }
  const meanLuminance = samples ? totalLuminance / samples : 1;
  const averageSaturation = samples ? totalSaturation / samples : 0;
  const dominantIndex = bins.indexOf(Math.max(...bins));
  const dominantHue = dominantIndex < 0 || bins[dominantIndex] === 0 ? 18 : dominantIndex * 15 + 7.5;
  const dark = meanLuminance < 0.29;
  const background = hslToHex(dominantHue, Math.min(0.19, Math.max(0.07, averageSaturation * 0.23)), dark ? 0.13 : 0.965);
  const initialAccent = hslToHex(dominantHue, Math.min(0.66, Math.max(0.42, averageSaturation * 1.25)), dark ? 0.75 : 0.34);
  const accent = optimizeContrast(initialAccent, background, 4.5);
  const text = optimizeContrast(dark ? "#F5F5F4" : "#17181A", background, 4.5);
  const desktopTreatment = getHeroTextTreatment(desktop, desktopWidth, desktopHeight);
  const mobileTreatment = getHeroTextTreatment(mobile, mobileWidth, mobileHeight);
  return { background, accent, text, heroTextDesktop: desktopTreatment.text, heroTextMobile: mobileTreatment.text, heroOverlayDesktop: desktopTreatment.overlay, heroOverlayMobile: mobileTreatment.overlay, meanLuminance };
}

export type SiteThemeInput = {
  themeMode: ThemeMode;
  presetId: ThemePresetId;
  custom: ThemeColors;
  autoPalette: AutoPalette | null;
};

export type ResolvedSiteTheme = ThemeColors & {
  muted: string;
  border: string;
  borderStrong: string;
  surface: string;
  inverse: string;
  inverseText: string;
  inverseMuted: string;
  accentSoft: string;
  buttonBackground: string;
  buttonText: string;
  heroTextDesktop: string;
  heroTextMobile: string;
  heroOverlayDesktop: string;
  heroOverlayMobile: string;
};

export function resolveSiteTheme(input: SiteThemeInput): ResolvedSiteTheme {
  const preset = THEME_PRESETS.find(item => item.id === input.presetId) ?? THEME_PRESETS[0];
  const selected = input.themeMode === "custom" ? input.custom : input.themeMode === "preset" ? preset.colors : input.autoPalette ?? DEFAULT_COLORS;
  const background = normalizeHex(selected.background) ?? DEFAULT_COLORS.background;
  const accent = normalizeHex(selected.accent) ?? DEFAULT_COLORS.accent;
  const text = normalizeHex(selected.text) ?? DEFAULT_COLORS.text;
  const isDark = relativeLuminance(background) < 0.35;
  const inverse = text;
  const inverseText = background;
  const muted = optimizeContrast(mix(background, text, isDark ? 0.66 : 0.56), background, 4.5);
  return {
    background, accent, text, muted,
    border: mix(background, text, 0.19),
    borderStrong: mix(background, text, 0.34),
    surface: mix(background, text, 0.025),
    inverse,
    inverseText,
    inverseMuted: optimizeContrast(mix(inverse, inverseText, 0.62), inverse, 4.5),
    accentSoft: mix(background, accent, 0.10),
    buttonBackground: text,
    buttonText: background,
    heroTextDesktop: input.autoPalette?.heroTextDesktop ?? "#FFFFFF",
    heroTextMobile: input.autoPalette?.heroTextMobile ?? "#FFFFFF",
    heroOverlayDesktop: input.autoPalette?.heroOverlayDesktop ?? "linear-gradient(90deg, rgba(0,0,0,.42), rgba(0,0,0,.12) 58%, transparent 82%)",
    heroOverlayMobile: input.autoPalette?.heroOverlayMobile ?? "linear-gradient(180deg, rgba(0,0,0,.38), rgba(0,0,0,.10) 70%, transparent)",
  };
}

export function themeCssVariables(theme: ResolvedSiteTheme): Record<`--${string}`, string> {
  return {
    "--site-bg": theme.background,
    "--site-accent": theme.accent,
    "--site-text": theme.text,
    "--site-muted": theme.muted,
    "--site-border": theme.border,
    "--site-border-strong": theme.borderStrong,
    "--site-surface": theme.surface,
    "--site-inverse": theme.inverse,
    "--site-inverse-text": theme.inverseText,
    "--site-inverse-muted": theme.inverseMuted,
    "--site-accent-soft": theme.accentSoft,
    "--site-button-bg": theme.buttonBackground,
    "--site-button-text": theme.buttonText,
    "--hero-text-desktop": theme.heroTextDesktop,
    "--hero-text-mobile": theme.heroTextMobile,
    "--hero-overlay-desktop": theme.heroOverlayDesktop,
    "--hero-overlay-mobile": theme.heroOverlayMobile,
  };
}
