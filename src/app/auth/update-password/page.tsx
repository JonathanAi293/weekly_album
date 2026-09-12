import { UpdatePasswordForm } from "@/components/UpdatePasswordForm";

export const dynamic = "force-dynamic";

export default function UpdatePasswordPage() {
  return <main className="page detail-shell"><section className="issue-hero"><div className="eyebrow">Friday record room</div><h1 className="serif">周五唱片室</h1><p>为下一次安静的聆听，重新设置进入这里的密码。</p></section><UpdatePasswordForm /></main>;
}
