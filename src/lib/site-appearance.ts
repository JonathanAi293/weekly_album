import "server-only";
import { unstable_cache } from "next/cache";
import { after } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAlbumCover } from "@/lib/cover";
import type { FeedbackRecord } from "@/lib/feedback";
import { isNumericRating } from "@/lib/rating";
import { analyzeStoredImage } from "@/lib/server-image-analysis";
import { readSiteSettings, saveAutoPalette, type SiteSettings, type SiteSettingsState } from "@/lib/site-settings";
import type { AutoPalette } from "@/lib/site-theme";
import { auditStep } from "@/lib/perf-audit";

type Candidate = {
  albumId: string;
  title: string;
  artist: string;
  issueNumber: number;
  issueSlug: string;
  displayOrder: number;
  rating: number;
  imageUrls: string[];
};

export type HeroAlbumSummary = Pick<Candidate, "albumId" | "title" | "artist" | "issueNumber" | "issueSlug" | "rating"> & { imageUrl: string | null };
export type SiteHero = {
  imageUrl: string | null;
  imageCandidates: string[];
  source: "manual" | "auto" | "default";
  album: HeroAlbumSummary | null;
  autoAlbum: HeroAlbumSummary | null;
  desktopFocusX: number;
  desktopFocusY: number;
  mobileFocusX: number;
  mobileFocusY: number;
  palette: AutoPalette | null;
};

export type SiteAppearance = {
  settings: SiteSettings;
  settingsReady: boolean;
  settingsError: string | null;
  hero: SiteHero;
};

type IssueRow = {
  slug: string;
  issue_number: number;
  recommendations: Array<{
    display_order: number;
    albums: {
      id: string;
      title: string;
      artist: string;
      manual_cover_url: string | null;
      musicbrainz_release_group_id: string | null;
      cover_fallback_url: string | null;
      cover_url: string | null;
    } | null;
  }>;
};

const readRatedIssueRows = unstable_cache(async () => {
  const supabase = createAdminClient();
  const { data, error } = await auditStep("appearance rated candidates query", async () => await supabase.from("issues").select("slug, issue_number, recommendations(display_order, albums(id, title, artist, manual_cover_url, musicbrainz_release_group_id, cover_fallback_url, cover_url))").eq("status", "published").order("issue_number", { ascending: false }));
  if (error) throw error;
  return (data ?? []) as unknown as IssueRow[];
}, ["hero-issue-metadata"], { tags: ["issues"] });

async function getRatedCandidates(feedback: FeedbackRecord[]): Promise<Candidate[]> {
  const numeric = new Map(feedback.filter(record => isNumericRating(record.rating, record.ratingStatus) && record.rating !== null && record.rating >= 7).map(record => [record.albumId, record.rating as number]));
  if (!numeric.size) return [];
  try {
    const issues = await readRatedIssueRows();
    const candidates: Candidate[] = [];
    for (const issue of [...issues].sort((a, b) => b.issue_number - a.issue_number)) {
      const recommendations = [...(issue.recommendations ?? [])].sort((a, b) => a.display_order - b.display_order);
      const rated = recommendations.flatMap(recommendation => {
        const album = recommendation.albums;
        const rating = album ? numeric.get(album.id) : undefined;
        if (!album || rating === undefined) return [];
        return [{
          albumId: album.id,
          title: album.title,
          artist: album.artist,
          issueNumber: issue.issue_number,
          issueSlug: issue.slug,
          displayOrder: recommendation.display_order,
          rating,
          imageUrls: resolveAlbumCover({ manualCoverUrl: album.manual_cover_url, musicbrainzReleaseGroupId: album.musicbrainz_release_group_id, fallbackUrl: album.cover_fallback_url, legacyCoverUrl: album.cover_url }) ?? [],
        }];
      }).sort((a, b) => b.rating - a.rating || a.displayOrder - b.displayOrder);
      candidates.push(...rated);
    }
    // Issues are visited newest-first; only after exhausting one issue do we inspect its predecessor.
    // Within an issue, the highest eligible score wins, then original editorial order breaks ties.
    return candidates;
  } catch {
    return [];
  }
}

function cachedPalette(settings: SiteSettings, source: string) {
  return settings.autoPaletteSource === source ? settings.autoPalette : null;
}

function chooseAutomatic(candidates: Candidate[], settings: SiteSettings) {
  const allFallbackUrls = [...new Set(candidates.flatMap(candidate => candidate.imageUrls))];
  const firstCandidate = candidates.find(candidate => candidate.imageUrls.length > 0);
  const imageUrl = firstCandidate?.imageUrls[0] ?? null;
  const album: HeroAlbumSummary | null = firstCandidate && imageUrl ? { albumId:firstCandidate.albumId, title:firstCandidate.title, artist:firstCandidate.artist, issueNumber:firstCandidate.issueNumber, issueSlug:firstCandidate.issueSlug, rating:firstCandidate.rating, imageUrl } : null;
  return { album, palette:imageUrl ? cachedPalette(settings, imageUrl) : null, imageCandidates:allFallbackUrls };
}

function paletteLooksValid(palette: AutoPalette | null): palette is AutoPalette {
  return Boolean(palette && palette.background && palette.accent && palette.text && palette.heroTextDesktop && palette.heroTextMobile);
}

export async function getSiteAppearance(feedback: FeedbackRecord[]): Promise<SiteAppearance> {
  const state: SiteSettingsState = await auditStep("appearance settings query", readSiteSettings);
  const settings = state.settings;
  const candidates = await auditStep("appearance rated candidates", () => getRatedCandidates(feedback));
  const autoSuggestion = candidates.find(candidate => candidate.imageUrls.length > 0) ?? null;
  const automatic = settings.heroMode === "auto" || !settings.heroManualUrl
    ? chooseAutomatic(candidates, settings)
    : null;

  let source: SiteHero["source"] = "default";
  let imageUrl: string | null = null;
  let album: HeroAlbumSummary | null = null;
  let palette: AutoPalette | null = null;
  let imageCandidates: string[] = [];

  if (settings.heroMode === "manual" && settings.heroManualUrl) {
    source = "manual";
    imageUrl = settings.heroManualUrl;
    palette = cachedPalette(settings, imageUrl);
    const automaticCandidates = automatic ? automatic.imageCandidates : [...new Set(candidates.flatMap(candidate => candidate.imageUrls))];
    imageCandidates = [settings.heroManualUrl, ...automaticCandidates];
  }

  if (!imageUrl && automatic) {
    source = automatic.album ? "auto" : "default";
    imageUrl = automatic.album?.imageUrl ?? null;
    album = automatic.album;
    palette = automatic.palette;
    imageCandidates = automatic.imageCandidates;
  }

  if (imageUrl && !paletteLooksValid(palette) && state.ready) {
    const sourceToAnalyze = imageUrl;
    after(async () => {
      const analyzed = await analyzeStoredImage(sourceToAnalyze);
      if (analyzed) try { await saveAutoPalette(sourceToAnalyze, analyzed); } catch { /* Keep the Hero visible even if palette persistence fails. */ }
    });
  }

  const hero: SiteHero = {
    imageUrl,
    imageCandidates,
    source,
    album,
    autoAlbum: automatic?.album ?? (autoSuggestion ? { albumId: autoSuggestion.albumId, title: autoSuggestion.title, artist: autoSuggestion.artist, issueNumber: autoSuggestion.issueNumber, issueSlug: autoSuggestion.issueSlug, rating: autoSuggestion.rating, imageUrl: autoSuggestion.imageUrls[0] ?? null } : null),
    desktopFocusX: source === "manual" ? settings.desktopFocusX : 50,
    desktopFocusY: source === "manual" ? settings.desktopFocusY : 50,
    mobileFocusX: source === "manual" ? settings.mobileFocusX : 50,
    mobileFocusY: source === "manual" ? settings.mobileFocusY : 50,
    palette,
  };
  return { settings, settingsReady: state.ready, settingsError: state.error, hero };
}
