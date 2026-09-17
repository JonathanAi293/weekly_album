import Link from "next/link";
import { MobileBackNavigation } from "./MobileBackNavigation";

export function SiteNav({ backHref }: { backHref?: string }) {
  return <nav className="nav"><div className="nav-left">{backHref && <MobileBackNavigation fallbackHref={backHref} />}<Link className="nav-brand" href="/"><span className="record" />周五唱片室</Link></div><div className="nav-links"><Link href="/archive">往期</Link><Link href="/want">想听</Link><Link href="/annual">年度</Link><Link href="/preferences">偏好</Link><Link href="/admin">编辑台</Link></div></nav>;
}
