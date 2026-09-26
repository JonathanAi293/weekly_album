"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileBackNavigation } from "./MobileBackNavigation";

const links = [
  { href: "/archive", label: "往期", english: "ARCHIVE" },
  { href: "/want", label: "想听", english: "TO LISTEN" },
  { href: "/annual", label: "年度", english: "YEARBOOK" },
  { href: "/settings", label: "设置", english: "SETTINGS" },
  { href: "/admin", label: "编辑台", english: "STUDIO" },
];

export function SiteNav({ backHref }: { backHref?: string }) {
  const pathname = usePathname();
  return <nav className="nav" aria-label="主导航">
    <div className="nav-left">{backHref && <MobileBackNavigation fallbackHref={backHref} />}<Link className="nav-brand" href="/" prefetch={true}><span className="record" aria-hidden="true" />周五唱片室</Link></div>
    <div className="nav-links">{links.map(link => {
      const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
      return <Link href={link.href} key={link.href} prefetch={true} aria-current={active ? "page" : undefined}><span>{link.label}</span><small>{link.english}</small></Link>;
    })}</div>
  </nav>;
}
