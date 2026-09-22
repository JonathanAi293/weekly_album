"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];

export function ManualCoverEditor({ albumId, initialUrl }: { albumId:string; initialUrl:string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(initialUrl ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function save(value:string | null) {
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/albums/${albumId}/cover`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ manualCoverUrl:value }) });
      const payload = await response.json() as { error?:string };
      if (!response.ok) throw new Error(payload.error ?? "无法保存封面。");
      setMessage(value ? "已保存手动封面。" : "已清除手动封面，将恢复自动来源。");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "无法保存封面。"); }
    finally { setSaving(false); }
  }

  async function upload(file:File) {
    if (!acceptedImageTypes.includes(file.type)) { setMessage("请选择 JPG、PNG 或 WebP 图片。"); return; }
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) { setMessage("图片需小于 5MB。"); return; }
    setSaving(true); setMessage("");
    try {
      const formData = new FormData(); formData.append("file", file);
      const response = await fetch(`/api/admin/albums/${albumId}/cover/upload`, { method:"POST", body:formData });
      const payload = await response.json() as { error?:string; manualCoverUrl?:string };
      if (!response.ok) throw new Error(payload.error ?? "无法上传封面。");
      setUrl(payload.manualCoverUrl ?? "");
      setMessage("封面已上传并设为手动封面。");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "无法上传封面。"); }
    finally { setSaving(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  if (!open) return <button className="auth-link cover-edit-trigger" type="button" onClick={() => setOpen(true)}>补充封面</button>;
  return <div className="cover-editor"><label>补充封面</label><input ref={fileInput} className="cover-file-input" type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} /><div className="auth-actions"><button className="status active" type="button" disabled={saving} onClick={() => fileInput.current?.click()}>{saving ? "上传中…" : "从设备选择图片"}</button></div><label htmlFor={`cover-${albumId}`}>或粘贴 HTTPS 图片链接</label><input id={`cover-${albumId}`} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" inputMode="url" /><div className="auth-actions"><button className="status" type="button" disabled={saving || !url.trim()} onClick={() => save(url.trim())}>{saving ? "保存中…" : "保存图片链接"}</button>{initialUrl && <button className="status" type="button" disabled={saving} onClick={() => save(null)}>恢复自动封面</button>}<button className="auth-link" type="button" disabled={saving} onClick={() => setOpen(false)}>取消</button></div><p className="mobile-note">支持 JPG、PNG、WebP，最大 5MB；HEIC 请先转换后上传。</p>{message && <p className="mobile-note" role="status">{message}</p>}</div>;
}
