/** Deterministic identity checks. Never treats a year or a cover URL as identity. */
export type IdentityAlbum = {
  title:string; artist:string; release_year:number;
  cover?:{ musicbrainz_release_group_id:string | null };
  links?:Record<string, string | null>;
};
export type CatalogAlbum = IdentityAlbum & {
  id:string; canonical_key:string; musicbrainz_release_group_id:string | null;
  external_urls:Record<string, string | null>;
  issues:Array<{ issue_number:number; slug:string; published_at:string; status:string }>;
  feedback:{ listening_status:string | null; rating:number | null; rating_status:string } | null;
};
export type DuplicateMatch = { album:CatalogAlbum; kind:"exact" | "possible"; reason:string };
export type DuplicateCheck = { index:number; matches:DuplicateMatch[]; internal:Array<{ index:number; kind:"exact" | "possible" }>; needsDecision:boolean };
export type ImportDecision = { index:number; action:"skip" | "include"; albumId?:string | null };
export type ImportCatalog = { albums:CatalogAlbum[]; fingerprint:string };

export function normalizeName(value:string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

// Recognize album URLs only; track/artist/store-home URLs must not imply equality.
export function platformIds(album:IdentityAlbum): string[] {
  const ids:string[] = [];
  const mbid = album.cover?.musicbrainz_release_group_id;
  if (mbid) ids.push(`mb:${mbid.toLowerCase()}`);
  for (const value of Object.values(album.links ?? {})) {
    if (!value) continue;
    try {
      const url = new URL(value), host = url.hostname.toLowerCase(), path = url.pathname;
      let match:RegExpMatchArray | null;
      if (host === "open.spotify.com" && (match = path.match(/^\/(?:intl-[^/]+\/)?album\/([A-Za-z0-9]+)\/?$/))) ids.push(`spotify:${match[1]}`);
      if (host === "music.apple.com" && (match = path.match(/^\/[a-z-]+\/album\/(?:[^/]+\/)?(\d+)\/?$/i))) ids.push(`apple:${match[1]}`);
      if (host.endsWith(".bandcamp.com") && /^\/album\/[^/]+\/?$/.test(path)) ids.push(`bandcamp:${host}${path.replace(/\/$/, "").toLowerCase()}`);
      if (host === "musicbrainz.org" && (match = path.match(/^\/release-group\/([a-f0-9-]{36})\/?$/i))) ids.push(`mb:${match[1].toLowerCase()}`);
    } catch { /* URL validation belongs to the importer. */ }
  }
  return ids;
}

function baseTitle(value:string) {
  return normalizeName(value.replace(/\s*[([{（【][^\])}）】]*(?:deluxe|expanded|remaster(?:ed)?|anniversary|豪华|豪華|重制|重製|周年)[^\])}）】]*[\])}）】]/gi, "").replace(/\s*[-–:]\s*(?:deluxe|expanded|remaster(?:ed)?|anniversary).*$/i, "").replace(/\s+(?:deluxe|expanded|remaster(?:ed)?)(?:\s+(?:edition|version))?$/i, ""));
}

export function identityMatch(a:IdentityAlbum, b:IdentityAlbum): "exact" | "possible" | null {
  const bIds = new Set(platformIds(b));
  if (platformIds(a).some(id => bIds.has(id))) return "exact";
  if (normalizeName(a.artist) !== normalizeName(b.artist)) return null;
  const aTitle = normalizeName(a.title), bTitle = normalizeName(b.title);
  if (aTitle && aTitle === bTitle) return "exact";
  if (baseTitle(a.title) && baseTitle(a.title) === baseTitle(b.title)) return "possible";
  // Small title variations only; no fuzzy artist aliases or AI guesses.
  if (Math.min(aTitle.length, bTitle.length) >= 8 && (aTitle.includes(bTitle) || bTitle.includes(aTitle))) return "possible";
  return null;
}

export function checkDuplicates(albums:IdentityAlbum[], catalog:CatalogAlbum[]): DuplicateCheck[] {
  return albums.map((album, index) => {
    const matches:DuplicateMatch[] = catalog.flatMap(existing => {
      const kind = identityMatch(album, { ...existing, cover:{ musicbrainz_release_group_id:existing.musicbrainz_release_group_id }, links:existing.external_urls });
      return kind ? [{ album:existing, kind, reason:kind === "exact" ? "平台专辑 ID 或艺术家＋专辑名一致（不以年份区分）" : "同一艺术家的标题或发行版本相近，请核对" }] : [];
    });
    const internal:DuplicateCheck["internal"] = [];
    albums.forEach((other, otherIndex) => {
      if (otherIndex === index) return;
      const kind = identityMatch(album, other);
      if (kind) internal.push({ index:otherIndex, kind });
    });
    return { index, matches, internal, needsDecision:internal.length > 0 || matches.some(match => match.kind === "possible" || match.album.issues.length > 0) || matches.filter(match => match.kind === "exact").length > 1 };
  });
}

/** Re-evaluated by the server, not trusted from preview/browser. */
export function resolveImport(albums:IdentityAlbum[], checks:DuplicateCheck[], decisions:ImportDecision[], options:{ minimum?:number; targetSlug?:string } = {}) {
  if (new Set(decisions.map(d => d.index)).size !== decisions.length || decisions.some(d => !Number.isInteger(d.index) || d.index < 0 || d.index >= albums.length || !["skip", "include"].includes(d.action))) throw new Error("查重处理选项无效，请重新预览。");
  const selected:Array<{ index:number; albumId:string | null }> = [];
  for (const check of checks) {
    const decision = decisions.find(d => d.index === check.index);
    if (decision?.action === "skip") continue;
    if (check.needsDecision && decision?.action !== "include") throw new Error(`第 ${check.index + 1} 张存在重复或疑似重复，请先跳过或明确确认。`);
    const exact = check.matches.filter(m => m.kind === "exact");
    let albumId = decision?.albumId ?? null;
    if (albumId && !check.matches.some(m => m.album.id === albumId)) throw new Error("所选历史专辑不在查重结果中，请重新预览。");
    if (exact.length && !albumId) {
      if (exact.length !== 1) throw new Error("匹配到多个历史专辑，请明确选择要复用的记录。");
      albumId = exact[0].album.id;
    }
    if (options.targetSlug && check.matches.some(m => m.kind === "exact" && m.album.issues.some(i => i.slug === options.targetSlug))) throw new Error(`第 ${check.index + 1} 张已在目标专栏中，请跳过，或前往「编辑栏目」修改原条目。`);
    if (options.targetSlug && albumId && check.matches.some(m => m.album.id === albumId && m.album.issues.some(i => i.slug === options.targetSlug))) throw new Error("所选唱片已在目标专栏中，请跳过或编辑原条目。");
    selected.push({ index:check.index, albumId });
  }
  const minimum = options.minimum ?? 2;
  if (selected.length < minimum || selected.length > 14) throw new Error(minimum === 1 ? "没有可保存的专辑。本次需保留 1–14 张。" : "处理重复项后，每期仍需保留 2–14 张专辑。请补充或替换推荐后重新预览。");
  for (let i = 0; i < selected.length; i++) for (let j = 0; j < i; j++) {
    if ((selected[i].albumId && selected[i].albumId === selected[j].albumId) || identityMatch(albums[selected[i].index], albums[selected[j].index]) === "exact") throw new Error("同一期不能收录同一张专辑两次，请跳过其中一项。");
  }
  return selected;
}
