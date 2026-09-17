"use client";

import { useState } from "react";

type IssueChoice = { id:string; number:string; title:string; date:string };
type ImportedPreview = { issue:{ issue_number:number; publish_date:string; title:string }; albums:Array<{ title:string; artist:string; release_year:number; recommendation_type:"taste_match" | "exploration"; tags:string[]; review_sources:Array<{ name:string; url:string }> }> };
type ExportPreview = { mode:"issue" | "changes"; issueId:string | null; content:string; items:Array<{ id:string; updatedAt:string }>; count:number };

async function request<T>(url:string, body:Record<string, unknown>) {
  const response = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body) });
  const payload = await response.json() as T & { error?:string };
  if (!response.ok) throw new Error(payload.error ?? "操作失败。");
  return payload;
}

export function ImportExportPanel({ issues }: { issues:IssueChoice[] }) {
  const [raw, setRaw] = useState("");
  const [importPreview, setImportPreview] = useState<ImportedPreview | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [busy, setBusy] = useState<"import-preview" | "import-confirm" | "export-preview" | "copy" | "confirm" | "latest" | null>(null);
  const [exportMode, setExportMode] = useState<"changes" | "issue">("changes");
  const [issueId, setIssueId] = useState(issues[0]?.id ?? "");
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);
  const [exportMessage, setExportMessage] = useState("");
  const [latestContent, setLatestContent] = useState<string | null>(null);

  async function previewImport() {
    setBusy("import-preview"); setImportMessage(""); setImportPreview(null);
    try { const result = await request<{ payload:ImportedPreview }>("/api/admin/import", { action:"preview", raw }); setImportPreview(result.payload); setImportMessage("格式检查通过。确认后才会写入专栏与唱片库。"); }
    catch (error) { setImportMessage(error instanceof Error ? error.message : "无法检查导入内容。"); }
    finally { setBusy(null); }
  }
  async function confirmImport() {
    setBusy("import-confirm"); setImportMessage("");
    try { await request<{ issueId:string }>("/api/admin/import", { action:"confirm", raw }); setImportMessage("本期已导入并发布。可以回到首页阅读。"); setImportPreview(null); setRaw(""); }
    catch (error) { setImportMessage(error instanceof Error ? error.message : "导入失败。"); }
    finally { setBusy(null); }
  }
  async function previewExport() {
    setBusy("export-preview"); setExportMessage("");
    try { const result = await request<{ preview:ExportPreview }>("/api/admin/export", { action:"preview", mode:exportMode, issueId:exportMode === "issue" ? issueId : null }); setExportPreview(result.preview); setExportMessage(`已生成预览：${result.preview.count} 条反馈。此时尚未更新“已导出”记录。`); }
    catch (error) { setExportMessage(error instanceof Error ? error.message : "无法生成导出预览。"); }
    finally { setBusy(null); }
  }
  async function markExported() {
    if (!exportPreview) return;
    setBusy("confirm"); setExportMessage("");
    try { await request("/api/admin/export", { action:"confirm", preview:exportPreview }); setExportMessage("已标记为成功导出；下次“变化反馈”不会重复包含未变化的记录。"); }
    catch (error) { setExportMessage(error instanceof Error ? error.message : "无法确认导出。"); }
    finally { setBusy(null); }
  }
  async function copyAndConfirm() {
    if (!exportPreview) return;
    setBusy("copy"); setExportMessage("");
    try { await navigator.clipboard.writeText(exportPreview.content); await markExported(); }
    catch { setExportMessage("浏览器未允许剪贴板写入。请手动复制下方内容，确认复制完成后点击“我已复制，标记为已导出”。"); setBusy(null); }
  }
  async function loadLatest() {
    setBusy("latest");
    try { const result = await request<{ content:string | null }>("/api/admin/export", { action:"latest" }); setLatestContent(result.content); }
    catch (error) { setExportMessage(error instanceof Error ? error.message : "无法读取最近导出。"); }
    finally { setBusy(null); }
  }

  return <div className="exchange-grid">
    <section className="exchange-section">
      <div className="eyebrow">01 · Import column</div>
      <h2 className="serif">导入一期专栏</h2>
      <p className="reason">在 ChatGPT 中生成 <code>friday-records-v1</code> JSON 后粘贴至此。网页只做校验、预览与保存，不会调用任何 AI。</p>
      <textarea className="exchange-textarea" value={raw} onChange={event => { setRaw(event.target.value); setImportPreview(null); }} placeholder={'粘贴完整 JSON。可以保留 ```json 代码围栏。'} aria-label="专栏 JSON 导入内容" />
      <div className="auth-actions"><button className="status active" type="button" onClick={previewImport} disabled={!raw.trim() || busy !== null}>{busy === "import-preview" ? "检查中…" : "检查并预览"}</button>{importPreview && <button className="status" type="button" onClick={confirmImport} disabled={busy !== null}>{busy === "import-confirm" ? "导入中…" : "确认导入本期"}</button>}</div>
      {importMessage && <p className="exchange-message" role="status">{importMessage}</p>}
      {importPreview && <div className="exchange-preview"><div className="eyebrow">Ready to import</div><h3 className="serif">#{String(importPreview.issue.issue_number).padStart(3, "0")} · {importPreview.issue.title}</h3><p className="artist">{importPreview.issue.publish_date} · {importPreview.albums.length} 张专辑</p>{importPreview.albums.map((album, index) => <div className="exchange-album" key={`${album.artist}-${album.title}`}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{album.title}</b><p>{album.artist} · {album.release_year} · {album.recommendation_type === "exploration" ? "探索推荐" : "口味命中"}</p><p>{album.tags.join(" · ")}{album.review_sources[0] && <> · <a className="quiet-link" href={album.review_sources[0].url} target="_blank" rel="noreferrer">{album.review_sources[0].name} ↗</a></>}</p></div></div>)}</div>}
    </section>
    <section className="exchange-section">
      <div className="eyebrow">02 · Export feedback</div>
      <h2 className="serif">带走你的反馈</h2>
      <p className="reason">将 Markdown 粘贴回 ChatGPT，用它更新对你口味的理解。生成预览不会消耗或改变任何反馈记录。</p>
      <div className="exchange-options" role="radiogroup" aria-label="导出范围"><button type="button" className={`status ${exportMode === "changes" ? "active" : ""}`} onClick={() => setExportMode("changes")}>自上次导出后的变化</button><button type="button" className={`status ${exportMode === "issue" ? "active" : ""}`} onClick={() => setExportMode("issue")}>导出某一期反馈</button></div>
      {exportMode === "issue" && <select className="exchange-select" value={issueId} onChange={event => setIssueId(event.target.value)} aria-label="选择专栏期数">{issues.length ? issues.map(issue => <option key={issue.id} value={issue.id}>{issue.number} · {issue.title}</option>) : <option value="">暂无已发布专栏</option>}</select>}
      <div className="auth-actions"><button className="status active" type="button" onClick={previewExport} disabled={busy !== null || (exportMode === "issue" && !issueId)}>{busy === "export-preview" ? "整理中…" : "生成导出预览"}</button><button className="auth-link" type="button" onClick={loadLatest} disabled={busy !== null}>重新复制最近导出</button></div>
      {exportMessage && <p className="exchange-message" role="status">{exportMessage}</p>}
      {exportPreview && <div className="export-result"><textarea className="exchange-textarea export-content" value={exportPreview.content} readOnly aria-label="反馈 Markdown 导出内容" /><div className="auth-actions"><button className="status active" type="button" onClick={copyAndConfirm} disabled={busy !== null}>{busy === "copy" || busy === "confirm" ? "复制中…" : "复制并标记已导出"}</button><button className="status" type="button" onClick={markExported} disabled={busy !== null}>我已复制，标记为已导出</button></div></div>}
      {latestContent && <div className="export-result"><p className="mobile-note">最近一次成功导出的内容（重新复制不会推进导出游标）：</p><textarea className="exchange-textarea export-content" value={latestContent} readOnly aria-label="最近导出内容" /></div>}
    </section>
  </div>;
}
