"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArchiveCoverStrip } from "@/components/ArchiveCoverStrip";
import { YearSelector } from "@/components/YearSelector";
import type { ArchiveIssue } from "@/lib/models";

export function ArchiveBrowser({ issues }: { issues:ArchiveIssue[] }) {
  const years = useMemo(() => [...new Set(issues.flatMap(issue => issue.releaseYear === null ? [] : [issue.releaseYear]))].sort((a, b) => b - a), [issues]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const year = years.includes(selectedYear ?? -1) ? selectedYear : years[0] ?? null;
  const visibleIssues = year === null ? [] : issues.filter(issue => issue.releaseYear === year);

  return <>
    <YearSelector years={years} selectedYear={year} onSelect={setSelectedYear} label="按推荐专辑发行年份选择往期" />
    {visibleIssues.length ? <div className="archive-list">{visibleIssues.map(issue => <Link href={`/issues/${issue.slug}`} className="archive-row" key={issue.slug}>
      <span className="eyebrow archive-number">{issue.number}</span>
      <div className="archive-copy"><h2 className="serif">{issue.title}</h2><p className="artist">{issue.date} · {issue.albumCount} 张专辑</p></div>
      <span className="quiet-link">打开 →</span>
      <ArchiveCoverStrip albums={issue.albumCovers} />
    </Link>)}</div> : <div className="collection-empty"><h2 className="serif">这个年份还没有专栏。</h2></div>}
  </>;
}
