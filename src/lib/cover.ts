export type AlbumCover = {
  manualCoverUrl?: string | null;
  musicbrainzReleaseGroupId?: string | null;
  fallbackUrl?: string | null;
  legacyCoverUrl?: string | null;
};

const mbidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isReleaseGroupMbid(value: unknown): value is string {
  return typeof value === "string" && mbidPattern.test(value.trim());
}

export function isSafeCoverUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

export function coverArtArchiveUrl(releaseGroupId: string | null | undefined) {
  return isReleaseGroupMbid(releaseGroupId) ? `https://coverartarchive.org/release-group/${releaseGroupId.trim().toLowerCase()}/front-500` : null;
}

/** Ordered display candidates only. The final placeholder is rendered by AlbumCover. */
export function resolveAlbumCover(cover: AlbumCover): string[] {
  const candidates = [cover.manualCoverUrl, coverArtArchiveUrl(cover.musicbrainzReleaseGroupId), cover.fallbackUrl, cover.legacyCoverUrl];
  return [...new Set(candidates.filter(isSafeCoverUrl))];
}
