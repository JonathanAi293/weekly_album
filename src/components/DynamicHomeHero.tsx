"use client";

/* The Hero needs direct remote image loading and onError fallback across heterogeneous cover hosts. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useSiteAppearance } from "./SiteAppearanceProvider";

function HeroFrame({ fallbackHref }: { fallbackHref?: string }) {
  const { hero } = useSiteAppearance();
  const [imageIndex, setImageIndex] = useState(0);
  const imageUrl = hero.imageCandidates[imageIndex] ?? null;
  const style = {
    "--hero-focus-x-desktop": `${hero.desktopFocusX}%`,
    "--hero-focus-y-desktop": `${hero.desktopFocusY}%`,
    "--hero-focus-x-mobile": `${hero.mobileFocusX}%`,
    "--hero-focus-y-mobile": `${hero.mobileFocusY}%`,
  } as CSSProperties;
  return <section className={`home-hero${imageUrl ? " has-image" : ""}${imageIndex > 0 ? " image-fallback" : ""}`} style={style} aria-labelledby="home-title">
    {imageUrl && <img className="home-hero-image" src={imageUrl} alt="" aria-hidden="true" fetchPriority="high" onError={() => setImageIndex(index => index + 1)} />}
    <div className="home-hero-inner">
      <div className="eyebrow">An independent listening journal · Since Friday</div>
      <h1 id="home-title"><span>FRIDAY</span><span>RECORDS</span></h1>
      <div className="home-hero-bottom">
        <p>每个周五，为你留几张值得完整听完的唱片。这里没有榜单的喧闹，只有一次次真实聆听留下的回声。</p>
        {(hero.album || fallbackHref) && <Link className="hero-link" href={hero.album ? `/issues/${hero.album.issueSlug}#${hero.album.albumId}` : fallbackHref!}>{hero.album ? "进入高分唱片" : "阅读本周专栏"} <span aria-hidden="true">↗</span></Link>}
      </div>
    </div>
  </section>;
}

export function DynamicHomeHero({ fallbackHref }: { fallbackHref?: string }) {
  const { hero } = useSiteAppearance();
  return <HeroFrame key={hero.imageUrl ?? "default-hero"} fallbackHref={fallbackHref} />;
}
