"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        setState("ready");
      }
    });

    const resolveRecoverySession = async () => {
      const code = new URLSearchParams(window.location.search).get("code");

      // Supabase recovery links use a one-time PKCE code. Exchange it on this
      // exact page so the resulting session belongs to the password form rather
      // than falling through to the app home page.
      if (code) await supabase.auth.exchangeCodeForSession(code);

      const { data: { session } } = await supabase.auth.getSession();
      if (active) setState(session ? "ready" : "invalid");
    };

    void resolveRecoverySession();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8) {
      setMessage("请设置至少 8 位的新密码。");
      return;
    }
    if (password !== confirmation) {
      setMessage("两次输入的密码不一致。");
      return;
    }
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("新密码已保存，正在回到唱片室。");
    window.setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, 700);
  }

  if (state === "checking") return <section className="profile" style={{ marginTop:28 }}><div className="eyebrow">Password recovery</div><h2 className="serif">正在确认重置链接。</h2><p className="reason">正在为这次密码更新建立安全会话。</p></section>;

  if (state === "invalid") return <section className="profile" style={{ marginTop:28 }}><div className="eyebrow">Password recovery</div><h2 className="serif">重置链接已失效。</h2><p className="reason">请回到登录页重新发送一封重置邮件，再在这台设备上打开它。</p><Link className="auth-link" href="/login">回到登录</Link></section>;

  return <form onSubmit={submit} className="profile" style={{ marginTop:28 }}>
    <div className="eyebrow">Password recovery</div>
    <h2 className="serif">设置一个新密码</h2>
    <p className="reason">保存后会直接回到唱片室。请使用至少 8 位的密码。</p>
    <input className="comment" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} placeholder="新密码" style={{ minHeight:42, marginTop:14 }} />
    <input className="comment" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="再次输入新密码" style={{ minHeight:42, marginTop:8 }} />
    <button className="status active" type="submit" disabled={loading} style={{ marginTop:12 }}>{loading ? "保存中…" : "保存新密码"}</button>
    {message && <p className="mobile-note" role="status" style={{ marginTop:10 }}>{message}</p>}
  </form>;
}
