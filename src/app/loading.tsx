import { SiteNav } from "@/components/SiteNav";

export default function Loading() {
  return <main className="page detail-shell" aria-busy="true">
    <SiteNav />
    <section className="issue-hero route-loading" aria-live="polite">
      <div className="eyebrow">Turning the page</div>
      <p>正在翻阅唱片室…</p>
      <div className="route-loading-line" aria-hidden="true" />
    </section>
  </main>;
}
