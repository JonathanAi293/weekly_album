"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage("");
    const { error } = await createClient().auth.signInWithOtp({ email, options:{ emailRedirectTo:`${window.location.origin}/auth/callback?next=/` } });
    setLoading(false); setMessage(error ? error.message : "登录链接已发送，请在这台设备上打开邮件继续。 ");
  }
  return <form onSubmit={submit} className="profile" style={{ marginTop:28 }}><label className="eyebrow" htmlFor="email">Private access</label><h2 className="serif">进入唱片室</h2><p className="reason">使用你在 Supabase Auth 中允许的邮箱。我们会发送一封一次性登录链接。</p><input className="comment" id="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="你的邮箱" style={{ minHeight:42, marginTop:14 }} /><button className="status active" type="submit" disabled={loading} style={{ marginTop:12 }}>{loading ? "发送中…" : "发送登录链接"}</button>{message && <p className="mobile-note" style={{ marginTop:10 }}>{message}</p>}</form>;
}
