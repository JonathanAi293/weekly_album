import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveAlbumCover } from "@/lib/cover";
import type { FeedbackRecord } from "@/lib/feedback";
import { isNumericRating } from "@/lib/rating";
import { analyzeStoredImage } from "@/lib/server-image-analysis";
import { readSiteSettings, saveAutoPalette, type SiteSettings, type SiteSettingsState } from "@/lib/site-settings";
import { resolveSiteTheme, type AutoPalette, type ResolvedSiteTheme, themeCssVariables } from "@/lib/site-theme";

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
  manualFallback: boolean;
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
  theme: ResolvedSiteTheme;
  cssVariables: Record<`--${string}`, string>;
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

async function getRatedCandidates(feedback: FeedbackRecord[]): Promise<Candidate[]> {
  const numeric = new Map(feedback.filter(record => isNumericRating(record.rating, record.ratingStatus) && record.rating !== null && record.rating >= 6).map(record => [record.albumId, record.rating as number]));
  if (!numeric.size) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("issues").select("slug, issue_number, recommendations(display_order, albums(id, title, artist, manual_cover_url, musicbrainz_release_group_id, cover_fallback_url, cover_url))").eq("status", "published").order("issue_number", { ascending: false });
    if (error) return [];
    const issues = (data ?? []) as unknown as IssueRow[];
    issues.sort((a, b) => b.issue_number - a.issue_number);
    const candidates: Candidate[] = [];
    for (const issue of issues) {
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
    return candidates.sort((a, b) => b.rating - a.rating || b.issueNumber - a.issueNumber || a.displayOrder - b.displayOrder);
  } catch {
    return [];
  }
}

function cachedPalette(settings: SiteSettings, source: string) {
  return settings.autoPaletteSource === source ? settings.autoPalette : null;
}

async function paletteFor(source: string, settings: SiteSettings) {
  return cachedPalette(settings, source) ?? await analyzeStoredImage(source);
}

async function chooseAutomatic(candidates: Candidate[], settings: SiteSettings) {
  let checks = 0;
  const allFallbackUrls = [...new Set(candidates.flatMap(candidate => candidate.imageUrls))];
  const firstCandidate = candidates.find(candidate => candidate.imageUrls.length > 0);
  const unverifiedFallback = () => ({
    album: firstCandidate ? { albumId: firstCandidate.albumId, title: firstCandidate.title, artist: firstCandidate.artist, issueNumber: firstCandidate.issueNumber, issueSlug: firstCandidate.issueSlug, rating: firstCandidate.rating, imageUrl: firstCandidate.imageUrls[0] } : null,
    palette: null,
    imageCandidates: allFallbackUrls,
  });
  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    const candidate = candidates[candidateIndex];
    for (let sourceIndex = 0; sourceIndex < candidate.imageUrls.length; sourceIndex += 1) {
      if (checks >= 2) return unverifiedFallback();
      checks += 1;
      const imageUrl = candidate.imageUrls[sourceIndex];
      const palette = await paletteFor(imageUrl, settings);
      if (!palette) continue;
      const album: HeroAlbumSummary = { albumId: candidate.albumId, title: candidate.title, artist: candidate.artist, issueNumber: candidate.issueNumber, issueSlug: candidate.issueSlug, rating: candidate.rating, imageUrl };
      const fallbackUrls = [
        ...candidate.imageUrls.slice(sourceIndex + 1),
        ...candidates.slice(candidateIndex + 1).flatMap(item => item.imageUrls),
      ];
      return { album, palette, imageCandidates: [imageUrl, ...new Set(fallbackUrls)] };
    }
  }
  return unverifiedFallback();
}

function paletteLooksValid(palette: AutoPalette | null): palette is AutoPalette {
  return Boolean(palette && palette.background && palette.accent && palette.text && palette.heroTextDesktop && palette.heroTextMobile);
}

export async function getSiteAppearance(feedback: FeedbackRecord[]): Promise<SiteAppearance> {
  const state: SiteSettingsState = await readSiteSettings();
  const settings = state.settings;
  const candidates = await getRatedCandidates(feedback);
  const autoSuggestion = candidates.find(candidate => candidate.imageUrls.length > 0) ?? null;
  let automatic = settings.heroMode === "auto" || !settings.heroManualUrl
    ? await chooseAutomatic(candidates, settings)
    : null;

  let source: SiteHero["source"] = "default";
  let imageUrl: string | null = null;
  let album: HeroAlbumSummary | null = null;
  let palette: AutoPalette | null = null;
  let imageCandidates: string[] = [];
  let manualFallback = false;

  if (settings.heroMode === "manual" && settings.heroManualUrl) {
    const manualPalette = await paletteFor(settings.heroManualUrl, settings);
    if (paletteLooksValid(manualPalette)) {
      source = "manual";
      imageUrl = settings.heroManualUrl;
      palette = manualPalette;
      const automaticCandidates = automatic ? automatic.imageCandidates : [...new Set(candidates.flatMap(candidate => candidate.imageUrls))];
      imageCandidates = [settings.heroManualUrl, ...automaticCandidates];
    } else {
      manualFallback = true;
      automatic = await chooseAutomatic(candidates, settings);
    }
  }

  if (!imageUrl && automatic) {
    source = automatic.album ? "auto" : "default";
    imageUrl = automatic.album?.imageUrl ?? null;
    album = automatic.album;
    palette = automatic.palette;
    imageCandidates = automatic.imageCandidates;
  }

  if (imageUrl && paletteLooksValid(palette) && state.ready && settings.autoPaletteSource !== imageUrl) {
    try { await saveAutoPalette(imageUrl, palette); } catch { /* The Hero still renders if palette caching is unavailable. */ }
  }

  const theme = resolveSiteTheme({ themeMode: settings.themeMode, presetId: settings.presetId, custom: settings.custom, autoPalette: paletteLooksValid(palette) ? palette : null });
  const hero: SiteHero = {
    imageUrl,
    imageCandidates,
    source,
    manualFallback,
    album,
    autoAlbum: automatic?.album ?? (autoSuggestion ? { albumId: autoSuggestion.albumId, title: autoSuggestion.title, artist: autoSuggestion.artist, issueNumber: autoSuggestion.issueNumber, issueSlug: autoSuggestion.issueSlug, rating: autoSuggestion.rating, imageUrl: autoSuggestion.imageUrls[0] ?? null } : null),
    desktopFocusX: source === "manual" ? settings.desktopFocusX : 50,
    desktopFocusY: source === "manual" ? settings.desktopFocusY : 50,
    mobileFocusX: source === "manual" ? settings.mobileFocusX : 50,
    mobileFocusY: source === "manual" ? settings.mobileFocusY : 50,
    palette,
  };
  return { settings, settingsReady: state.ready, settingsError: state.error, hero, theme, cssVariables: themeCssVariables(theme) };
}
