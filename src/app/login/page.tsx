import { LoginForm } from "@/components/LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  return <main className="page detail-shell"><section className="issue-hero"><div className="eyebrow">Friday record room</div><h1 className="serif">周五唱片室</h1><p>这是只属于你的私人专栏。</p></section>{isSupabaseConfigured() ? <LoginForm /> : <div className="collection-empty"><span className="record" /><h2 className="serif">还没有连接数据库。</h2><p>复制 `.env.example` 为 `.env.local`，填入 Supabase URL 和 Publishable key 后即可登录。</p></div>}</main>;
}
