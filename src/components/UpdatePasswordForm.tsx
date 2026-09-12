"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (active) setReady(Boolean(session));
    };
    void checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) setReady(Boolean(session));
    });
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
    router.replace("/");
    router.refresh();
  }

  if (!ready) return <section className="profile" style={{ marginTop:28 }}><div className="eyebrow">Password recovery</div><h2 className="serif">正在确认重置链接。</h2><p className="reason">若链接已失效，请回到登录页重新发送一封重置邮件。</p></section>;

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
