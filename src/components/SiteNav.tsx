"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const primaryLinks = [
  { href: "/", label: "首页", english: "HOME" },
  { href: "/archive", label: "往期", english: "ARCHIVE" },
  { href: "/want", label: "想听", english: "TO LISTEN" },
  { href: "/annual", label: "年度", english: "YEARBOOK" },
];

const toolLinks = [
  { href: "/settings", label: "设置", english: "SETTINGS", note: "外观与首页开场" },
  { href: "/admin", label: "编辑台", english: "STUDIO", note: "专栏与个人记录" },
];

function isCurrentPath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const menuButton = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousDrawerOpen = document.body.dataset.siteDrawerOpen;
    document.body.style.overflow = "hidden";
    document.body.dataset.siteDrawerOpen = "true";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousDrawerOpen === undefined) delete document.body.dataset.siteDrawerOpen;
      else document.body.dataset.siteDrawerOpen = previousDrawerOpen;
      document.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => menuButton?.focus());
    };
  }, [isOpen]);

  return <nav className="nav" aria-label="主导航">
    <div className="nav-topline">
      <Link className="nav-brand" href="/" prefetch aria-label="周五唱片室首页">
        <span className="record" aria-hidden="true" />周五唱片室
      </Link>
      <button ref={menuButtonRef} className="nav-menu-button" type="button" aria-label={isOpen ? "关闭功能菜单" : "打开功能菜单"} aria-expanded={isOpen} aria-controls="site-tools-drawer" onClick={() => setIsOpen(open => !open)}>
        <span className={`hamburger${isOpen ? " is-open" : ""}`} aria-hidden="true"><i /><i /><i /></span>
      </button>
    </div>

    <div className="nav-links" aria-label="内容栏目">
      {primaryLinks.map(link => {
        const active = isCurrentPath(pathname, link.href);
        return <Link href={link.href} key={link.href} prefetch aria-current={active ? "page" : undefined}>
          <span>{link.label}</span><small>{link.english}</small>
        </Link>;
      })}
    </div>

    <button className={`drawer-backdrop${isOpen ? " is-open" : ""}`} type="button" tabIndex={isOpen ? 0 : -1} aria-label="点击关闭功能菜单" aria-hidden={!isOpen} onClick={() => setIsOpen(false)} />
    <aside ref={drawerRef} id="site-tools-drawer" className={`tools-drawer${isOpen ? " is-open" : ""}`} role="dialog" aria-modal={isOpen ? "true" : undefined} aria-labelledby="tools-drawer-title" aria-hidden={!isOpen}>
      <div className="tools-drawer-head">
        <div><div className="eyebrow">PRIVATE LISTENING ROOM</div><h2 id="tools-drawer-title" className="serif">功能</h2></div>
        <button ref={closeButtonRef} className="drawer-close" type="button" aria-label="关闭菜单" tabIndex={isOpen ? 0 : -1} onClick={() => setIsOpen(false)}><span aria-hidden="true">×</span></button>
      </div>
      <p className="tools-drawer-note">个性化外观与内容管理</p>
      <div className="tools-drawer-links">
        {toolLinks.map((link, index) => {
          const active = isCurrentPath(pathname, link.href);
          return <Link href={link.href} key={link.href} aria-current={active ? "page" : undefined} tabIndex={isOpen ? 0 : -1} onClick={() => setIsOpen(false)}>
            <span className="drawer-item-index">0{index + 1}</span>
            <span className="drawer-item-copy"><strong>{link.label}</strong><small>{link.note}</small></span>
            <span className="drawer-item-english">{link.english}</span>
          </Link>;
        })}
      </div>
      <div className="tools-drawer-foot"><span className="record" aria-hidden="true" /><small>周五唱片室 · 私人聆听档案</small></div>
    </aside>
  </nav>;
}
