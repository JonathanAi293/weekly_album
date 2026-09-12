"use client";

import { useMemo, useState } from "react";
import { CollectionAlbumCard } from "./CollectionAlbumCard";
import { useFeedback } from "./FeedbackProvider";
import type { LibraryAlbum } from "@/lib/models";
import { isNumericRating, type Rating } from "@/lib/rating";

type Tier = { id: string; rating: Rating; label: string; items: LibraryAlbum[] };

export function AnnualYearbook({ items }: { items: LibraryAlbum[] }) {
  const { feedback } = useFeedback();
  const years = useMemo(() => Array.from(new Set(items.filter(item => feedback[item.album.id]?.status === "listened").map(item => item.album.releaseYear))).sort((a, b) => b - a), [feedback, items]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  // If the selected year is no longer represented in listened albums, fall back
  // to the latest available year without scheduling a state update during render.
  const year = years.includes(selectedYear ?? -1) ? selectedYear : (years[0] ?? null);

  const tiers = useMemo(() => {
    if (year === null) return [] as Tier[];
    const listened = items.filter(item => item.album.releaseYear === year && feedback[item.album.id]?.status === "listened");
    const scored = new Map<number, LibraryAlbum[]>();
    const noRating: LibraryAlbum[] = [];
    const unscored: LibraryAlbum[] = [];
    listened.forEach(item => {
      const record = feedback[item.album.id];
      const rating = record?.rating ?? null;
      const ratingStatus = record?.ratingStatus ?? "pending";
      if (record?.ratingStatus === "no_rating") noRating.push(item);
      else if (isNumericRating(rating, ratingStatus)) scored.set(rating, [...(scored.get(rating) ?? []), item]);
      else unscored.push(item);
    });
    const ranked: Tier[] = Array.from(scored.entries()).sort(([a], [b]) => b - a).map(([rating, items]) => ({ id:`rating-${rating}`, rating, label:rating.toFixed(1), items }));
    if (noRating.length) ranked.push({ id:"no-rating", rating:null, label:"不评分", items:noRating });
    if (unscored.length) ranked.push({ id:"unrated", rating:null, label:"未评分", items:unscored });
    return ranked;
  }, [feedback, items, year]);

  if (!years.length) return <div className="collection-empty"><span className="record" /><h2 className="serif">年度还没有被写下。</h2><p>把一张当年发行的专辑标记为「已听」，它会按发行年份收进这里。</p></div>;
  return <><div className="year-tabs" aria-label="选择发行年份">{years.map(value => <button className={year === value ? "active" : ""} key={value} onClick={() => setSelectedYear(value)}>{value}</button>)}</div><div className="yearbook">{tiers.map(tier => <section className="rating-tier" key={tier.id}><div className="tier-heading"><h2 className="serif">{tier.label}</h2>{tier.rating !== null && <span>/ 10</span>}</div><div className="tier-row">{tier.items.map(item => <CollectionAlbumCard item={item} rating={tier.rating ?? undefined} context={item.album.tags[0]} key={item.album.id} />)}</div></section>)}</div></>;
}
