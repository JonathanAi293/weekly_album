"use client";

/* Native img elements keep arbitrary approved public-storage previews and crop controls unoptimized. */
/* eslint-disable @next/next/no-img-element */

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { HeroAlbumSummary } from "@/lib/site-appearance";
import type { AutoPalette, ThemePresetId } from "@/lib/site-theme";
import { contrastRatio, resolveSiteTheme, THEME_PRESETS } from "@/lib/site-theme";
import type { SiteSettingsDraft } from "@/lib/site-settings";

type Props = {
  settings: SiteSettingsDraft;
  settingsReady: boolean;
  settingsError: string | null;
  autoHero: HeroAlbumSummary | null;
  autoPalette: AutoPalette | null;
  manualPalette: AutoPalette | null;
};

function CropPreview({ label, url, x, y, aspect, onChange }: { label: string; url: string; x: number; y: number; aspect: string; onChange: (x: number, y: number) => void }) {
  const drag = useRef<{ x: number; y: number; focusX: number; focusY: number; width: number; height: number } | null>(null);
  function start(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = { x: event.clientX, y: event.clientY, focusX: x, focusY: y, width: rect.width, height: rect.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const state = drag.current;
    onChange(Math.round(Math.max(0, Math.min(100, state.focusX - (event.clientX - state.x) / state.width * 100))), Math.round(Math.max(0, Math.min(100, state.focusY - (event.clientY - state.y) / state.height * 100))));
  }
  return <div className="crop-control">
    <div className="crop-preview-label"><span>{label}</span><small>拖动预览调整裁切焦点</small></div>
    <div className="crop-stage" style={{ aspectRatio: aspect }} onPointerDown={start} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <img src={url} alt="" draggable={false} style={{ objectPosition: `${x}% ${y}%` }} />
      <span className="crop-crosshair" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true" />
    </div>
    <div className="crop-ranges">
      <label>左右 <input aria-label={`${label}左右裁切`} type="range" min="0" max="100" value={x} onChange={event => onChange(Number(event.target.value), y)} /> <output>{x}%</output></label>
      <label>上下 <input aria-label={`${label}上下裁切`} type="range" min="0" max="100" value={y} onChange={event => onChange(x, Number(event.target.value))} /> <output>{y}%</output></label>
    </div>
  </div>;
}

export function SiteSettingsEditor({ settings, settingsReady, settingsError, autoHero, autoPalette, manualPalette }: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<SiteSettingsDraft>(() => structuredClone(settings));
  const [uploadedPalette, setUploadedPalette] = useState<AutoPalette | null>(manualPalette);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const manualMode = draft.heroMode === "manual";
  const heroImage = manualMode ? draft.heroManualUrl : autoHero?.imageUrl;
  const selectedPalette = manualMode ? uploadedPalette : autoPalette;
  const previewTheme = useMemo(() => resolveSiteTheme({ themeMode: draft.themeMode, presetId: draft.presetId, custom: draft.custom, autoPalette: selectedPalette }), [draft, selectedPalette]);
  const customContrastOkay = contrastRatio(draft.custom.text, draft.custom.background) >= 4.5 && contrastRatio(draft.custom.accent, draft.custom.background) >= 4.5;

  function change<K extends keyof SiteSettingsDraft>(key: K, value: SiteSettingsDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
    setMessage(""); setError("");
  }
  function setFocus(desktop: boolean, x: number, y: number) {
    setDraft(current => desktop ? { ...current, desktopFocusX: x, desktopFocusY: y } : { ...current, mobileFocusX: x, mobileFocusY: y });
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/admin/site-settings/hero/upload", { method: "POST", body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "上传失败。");
      change("heroManualUrl", result.url);
      setUploadedPalette(result.palette ?? null);
      setMessage("图片已上传；保存设置后才会应用为首页 Hero。");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "上传失败。"); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/site-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "保存失败。");
      setMessage("设置已保存。首页将在刷新后使用新主题。");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败。"); }
    finally { setBusy(false); }
  }

  return <div className="settings-layout">
    <div className="settings-main">
      <section className="settings-section">
        <div className="settings-section-head"><div><div className="eyebrow">Opening image</div><h2 className="serif">首页 Hero</h2></div><p>让一张与你的聆听记录有关的封面，成为唱片室每周的开场。</p></div>
        <div className="settings-mode-switch" role="group" aria-label="Hero 图片模式">
          <button type="button" className={draft.heroMode === "auto" ? "active" : ""} aria-pressed={draft.heroMode === "auto"} onClick={() => change("heroMode", "auto")}>自动 · 高分唱片</button>
          <button type="button" className={draft.heroMode === "manual" ? "active" : ""} aria-pressed={draft.heroMode === "manual"} onClick={() => change("heroMode", "manual")}>手动选择</button>
        </div>
        {manualMode ? <div className="manual-hero-settings">
          <div className="upload-row"><div><strong>上传一张横幅封面</strong><p>JPG、PNG 或 WebP，最大 6MB。建议选择细节清晰、留有文字空间的唱片封面。</p></div><button type="button" className="settings-button" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? "处理中…" : draft.heroManualUrl ? "更换图片" : "选择图片"}</button><input ref={fileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void upload(event.target.files?.[0])} /></div>
          {draft.heroManualUrl && <><div className="crop-grid"><CropPreview label="桌面裁切" url={draft.heroManualUrl} x={draft.desktopFocusX} y={draft.desktopFocusY} aspect="2.65 / 1" onChange={(x, y) => setFocus(true, x, y)} /><CropPreview label="手机裁切" url={draft.heroManualUrl} x={draft.mobileFocusX} y={draft.mobileFocusY} aspect="3 / 4" onChange={(x, y) => setFocus(false, x, y)} /></div><button type="button" className="quiet-link remove-image" onClick={() => { change("heroManualUrl", null); setUploadedPalette(null); }}>移除手动图片</button></>}
          {!draft.heroManualUrl && <div className="settings-note">还没有手动图片。上传后可以分别调整桌面和手机上的画面焦点。</div>}
        </div> : <div className="auto-hero-summary">
          {autoHero ? <><img src={autoHero.imageUrl ?? undefined} alt="" /><div><div className="eyebrow">Current selection</div><h3 className="serif">{autoHero.title}</h3><p>{autoHero.artist} · #{String(autoHero.issueNumber).padStart(3, "0")} · 评分 {autoHero.rating.toFixed(1)}</p><small>先检查最新一期；只要该期有 7 分及以上的作品，就选其中最高分。仅当整期都没有达标作品时，才继续检查上一期。未评分和“不评分”不参与挑选。</small></div></> : <div className="settings-note">暂时没有符合条件的作品。自动模式会从最新专栏向前查找，等待一张至少 7 分的唱片成为首页开场。</div>}
        </div>}
      </section>

      <section className="settings-section">
        <div className="settings-section-head"><div><div className="eyebrow">Paper & ink</div><h2 className="serif">网站配色</h2></div><p>配色只改变纸张、文字与强调色，不会给专辑封面叠加色彩滤镜。</p></div>
        <div className="settings-mode-switch theme-mode-switch" role="group" aria-label="网站主题模式">
          <button type="button" className={draft.themeMode === "auto" ? "active" : ""} aria-pressed={draft.themeMode === "auto"} onClick={() => change("themeMode", "auto")}>随 Hero 自动</button>
          <button type="button" className={draft.themeMode === "preset" ? "active" : ""} aria-pressed={draft.themeMode === "preset"} onClick={() => change("themeMode", "preset")}>预设主题</button>
          <button type="button" className={draft.themeMode === "custom" ? "active" : ""} aria-pressed={draft.themeMode === "custom"} onClick={() => change("themeMode", "custom")}>自定义</button>
        </div>
        {draft.themeMode === "auto" && <p className="settings-note">系统会从当前 Hero 图片提取低饱和配色，并在服务端预先生成页面颜色，避免页面加载时闪烁。</p>}
        {draft.themeMode === "preset" && <div className="preset-grid">{THEME_PRESETS.map(preset => <button key={preset.id} type="button" className={`preset-card ${draft.presetId === preset.id ? "active" : ""}`} aria-pressed={draft.presetId === preset.id} onClick={() => change("presetId", preset.id as ThemePresetId)}><span className="preset-swatches" style={{ background: preset.colors.background, color: preset.colors.text }}><i style={{ background: preset.colors.accent }} /><i style={{ background: preset.colors.text }} /><i style={{ background: preset.colors.background }} /></span><strong>{preset.name}</strong><small>{preset.english}</small></button>)}</div>}
        {draft.themeMode === "custom" && <div className="custom-colors">{(["background", "accent", "text"] as const).map(key => <label key={key}><span>{key === "background" ? "纸张背景" : key === "accent" ? "强调色" : "正文颜色"}</span><span className="color-input"><input type="color" value={draft.custom[key]} aria-label={`${key}颜色选择器`} onChange={event => change("custom", { ...draft.custom, [key]: event.target.value.toUpperCase() })} /><input type="text" value={draft.custom[key]} aria-label={`${key}十六进制颜色`} maxLength={7} onChange={event => change("custom", { ...draft.custom, [key]: event.target.value })} /></span></label>)}<p className={`contrast-note ${customContrastOkay ? "good" : "warning"}`}>{customContrastOkay ? "当前文字与背景对比度符合可读性要求。" : "正文或强调色与背景的对比度偏低，请调深或调亮颜色。"}</p></div>}
      </section>

      <div className="settings-actions"><button type="button" className="settings-button primary" disabled={busy || !settingsReady || (manualMode && !draft.heroManualUrl) || (draft.themeMode === "custom" && !customContrastOkay)} onClick={() => void save()}>{busy ? "保存中…" : "保存设置"}</button><button type="button" className="quiet-link" disabled={busy} onClick={() => { setDraft(structuredClone(settings)); setUploadedPalette(manualPalette); setError(""); setMessage("已恢复到最近保存的设置。"); }}>恢复已保存设置</button>{message && <span role="status" className="form-message">{message}</span>}{error && <span role="alert" className="form-error">{error}</span>}</div>
      {!settingsReady && <p className="form-error">{settingsError ?? "设置存储尚未就绪。"} 请先执行 migration 后再保存。</p>}
    </div>

    <aside className="settings-preview-wrap"><div className="settings-preview-sticky"><div className="eyebrow">Live proof</div><h2 className="serif">页面预览</h2><div className="settings-preview" style={{ background: previewTheme.background, color: previewTheme.text, borderColor: previewTheme.border }}>
      <div className="preview-nav" style={{ background: previewTheme.inverse, color: previewTheme.inverseText }}><span>◉ 周五唱片室</span><small>往期　想听　年度</small></div>
      <div className="preview-hero" style={{ color: draft.heroMode === "manual" ? previewTheme.heroTextDesktop : previewTheme.heroTextDesktop }}>
        {heroImage && <img src={heroImage} alt="" style={{ objectPosition: manualMode ? `${draft.desktopFocusX}% ${draft.desktopFocusY}%` : "50% 50%" }} />}
        <span className="preview-overlay" style={{ background: selectedPalette?.heroOverlayDesktop ?? "linear-gradient(90deg,rgba(0,0,0,.48),rgba(0,0,0,.08),transparent)" }} />
        <div><small>AN INDEPENDENT LISTENING JOURNAL</small><strong>FRIDAY<br />RECORDS</strong><p>每个周五，为你留几张值得完整听完的唱片。</p></div>
      </div>
      <div className="preview-content"><small style={{ color: previewTheme.accent }}>THIS WEEK&apos;S FEATURE</small><h3 className="serif">一张唱片，留给慢一点的时间</h3><p>留白、纸张与声音之间的私人注脚。</p><button type="button" style={{ background: previewTheme.buttonBackground, color: previewTheme.buttonText }}>阅读本期 →</button></div>
    </div><p className="preview-caption">预览采用当前选择的 Hero 与主题；保存后全站统一生效。</p></div></aside>
  </div>;
}
