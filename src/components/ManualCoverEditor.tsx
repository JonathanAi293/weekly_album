"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ManualCoverEditor({ albumId, initialUrl }: { albumId:string; initialUrl:string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(initialUrl ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

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

  if (!open) return <button className="auth-link cover-edit-trigger" type="button" onClick={() => setOpen(true)}>补充封面</button>;
  return <div className="cover-editor"><label htmlFor={`cover-${albumId}`}>手动封面 URL</label><input id={`cover-${albumId}`} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" inputMode="url" /><div className="auth-actions"><button className="status active" type="button" disabled={saving || !url.trim()} onClick={() => save(url.trim())}>{saving ? "保存中…" : "保存封面"}</button>{initialUrl && <button className="status" type="button" disabled={saving} onClick={() => save(null)}>清除手动封面</button>}<button className="auth-link" type="button" disabled={saving} onClick={() => setOpen(false)}>取消</button></div>{message && <p className="mobile-note" role="status">{message}</p>}</div>;
}
