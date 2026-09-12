"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "reset";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();
    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setMessage("邮箱或密码不正确，请再试一次。");
        return;
      }
      router.replace("/");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setLoading(false);
    setMessage(error ? error.message : "如该邮箱可用，重置密码的邮件已发送。请在这台设备上打开链接继续。");
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage("");
    setPassword("");
  }

  const isReset = mode === "reset";
  return <form onSubmit={submit} className="profile" style={{ marginTop:28 }}>
    <label className="eyebrow" htmlFor="email">Private access</label>
    <h2 className="serif">{isReset ? "重置密码" : "进入唱片室"}</h2>
    <p className="reason">{isReset ? "输入你的邮箱，我们会发送一封用于设置新密码的邮件。" : "仅限你的私人账户。登录后，聆听记录会保留在这台设备上。"}</p>
    <input className="comment" id="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="你的邮箱" style={{ minHeight:42, marginTop:14 }} />
    {!isReset && <input className="comment" id="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="密码" style={{ minHeight:42, marginTop:8 }} />}
    <div className="auth-actions">
      <button className="status active" type="submit" disabled={loading}>{loading ? "处理中…" : isReset ? "发送重置邮件" : "登录"}</button>
      <button className="auth-link" type="button" onClick={() => switchMode(isReset ? "sign-in" : "reset")}>{isReset ? "返回登录" : "忘记密码"}</button>
    </div>
    {message && <p className="mobile-note" role="status" style={{ marginTop:10 }}>{message}</p>}
  </form>;
}
