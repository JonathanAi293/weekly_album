import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import type { FeedbackRecord } from "./feedback";
import type { Album, ArchiveIssue, Issue, LibraryAlbum, PreferenceProfile } from "./models";
import { deriveIssueReleaseYear } from "./archive";
import { isSupabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { getVerifiedUser } from "./verified-user";

type SourceRef = { name?: string; source?: string; title?: string; url?: string };
type DbAlbum = { id:string; title:string; artist:string; cover_url:string | null; manual_cover_url:string | null; musicbrainz_release_group_id:string | null; cover_fallback_url:string | null; release_date:string | null; release_year:number; tags:string[] | null };
type DbIssue = { id:string; slug:string; issue_number:number; title:string; subtitle?:string | null; editorial:string | null; published_at:string; status?:string };
type DbRecommendation = { display_order:number; recommendation_type:"taste_match" | "exploration"; recommendation_reason:string; review_summary:string; source_refs:SourceRef[] | null; albums:DbAlbum | null };

function issueDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} · Friday`;
}

function asAlbum(row: DbAlbum, recommendation: DbRecommendation): Album {
  const source = recommendation.source_refs?.[0];
  return {
    id:row.id, title:row.title, artist:row.artist, releaseDate:row.release_date, releaseYear:row.release_year, tags:row.tags ?? [], cover:{ manualCoverUrl:row.manual_cover_url, musicbrainzReleaseGroupId:row.musicbrainz_release_group_id, fallbackUrl:row.cover_fallback_url, legacyCoverUrl:row.cover_url },
    type:recommendation.recommendation_type === "exploration" ? "探索推荐" : "口味命中",
    reason:recommendation.recommendation_reason, review:recommendation.review_summary,
    source:source?.name ?? source?.source ?? "编辑资料", sourceUrl:source?.url ?? null,
  };
}

function asIssue(row: DbIssue & { recommendations?: DbRecommendation[] }): Issue {
  const recommendations = (row.recommendations ?? []).filter((item): item is DbRecommendation & { albums:DbAlbum } => Boolean(item.albums)).sort((a, b) => a.display_order - b.display_order);
  return { id:row.id, slug:row.slug, number:`#${String(row.issue_number).padStart(3, "0")}`, date:issueDate(row.published_at), title:row.title, subtitle:row.subtitle ?? null, intro:row.editorial ?? "", albums:recommendations.map(item => asAlbum(item.albums, item)) };
}

export async function requireUser() {
  if (!isSupabaseConfigured()) redirect("/login?reason=config");
  const user = await getVerifiedUser();
  if (!user) redirect("/login");
  return user;
}

const readFeedback = unstable_cache(async (userId: string): Promise<FeedbackRecord[]> => {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("feedback").select("album_id, listening_status, rating, rating_status, review, updated_at, status_updated_at").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map(row => ({ albumId:row.album_id, status:row.listening_status, rating:row.rating === null ? null : Number(row.rating), ratingStatus:row.rating_status, comment:row.review ?? "", updatedAt:row.updated_at, statusUpdatedAt:row.status_updated_at }));
}, ["user-feedback"], { tags: ["feedback"] });

export const getFeedbackForCurrentUser = cache(async (): Promise<FeedbackRecord[]> => {
  if (!isSupabaseConfigured()) return [];
  const user = await getVerifiedUser();
  if (!user) return [];
  return readFeedback(user.id);
});

const readCurrentIssue = unstable_cache(async () => {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("issues").select("id, slug, issue_number, title, subtitle, editorial, published_at, recommendations(display_order, recommendation_type, recommendation_reason, review_summary, source_refs, albums(id, title, artist, cover_url, manual_cover_url, musicbrainz_release_group_id, cover_fallback_url, release_date, release_year, tags))").eq("status", "published").order("issue_number", { ascending:false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? asIssue(data as unknown as DbIssue & { recommendations:DbRecommendation[] }) : null;
}, ["current-published-issue"], { tags: ["issues"] });

export async function getCurrentIssue() {
  await requireUser();
  return readCurrentIssue();
}

const readIssues = unstable_cache(async (): Promise<ArchiveIssue[]> => {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("issues").select("id, slug, issue_number, title, subtitle, editorial, published_at, recommendations(display_order, albums(id, title, release_year, cover_url, manual_cover_url, musicbrainz_release_group_id, cover_fallback_url))").eq("status", "published").order("issue_number", { ascending:false });
  if (error) throw error;
  return (data ?? []).map(row => {
    const recommendations = [...(row.recommendations ?? [])].sort((a, b) => a.display_order - b.display_order);
    const albumYears:number[] = [];
    const albumCovers = recommendations.flatMap(recommendation => {
      const album = recommendation.albums as unknown as Pick<DbAlbum, "id" | "title" | "release_year" | "cover_url" | "manual_cover_url" | "musicbrainz_release_group_id" | "cover_fallback_url"> | null;
      if (!album) return [];
      albumYears.push(album.release_year);
      return [{ id:album.id, title:album.title, cover:{ manualCoverUrl:album.manual_cover_url, musicbrainzReleaseGroupId:album.musicbrainz_release_group_id, fallbackUrl:album.cover_fallback_url, legacyCoverUrl:album.cover_url } }];
    });
    return { id:row.id, slug:row.slug, number:`#${String(row.issue_number).padStart(3, "0")}`, date:issueDate(row.published_at), title:row.title, intro:row.editorial ?? "", albumCount:recommendations.length, releaseYear:deriveIssueReleaseYear(albumYears), albumCovers };
  });
}, ["published-issue-archive"], { tags: ["issues"] });

export async function getIssues(): Promise<ArchiveIssue[]> {
  await requireUser();
  return readIssues();
}

const readIssueBySlug = unstable_cache(async (slug: string) => {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("issues").select("id, slug, issue_number, title, subtitle, editorial, published_at, recommendations(display_order, recommendation_type, recommendation_reason, review_summary, source_refs, albums(id, title, artist, cover_url, manual_cover_url, musicbrainz_release_group_id, cover_fallback_url, release_date, release_year, tags))").eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) throw error;
  return data ? asIssue(data as unknown as DbIssue & { recommendations:DbRecommendation[] }) : null;
}, ["published-issue-detail"], { tags: ["issues"] });

export async function getIssueBySlug(slug: string) {
  await requireUser();
  return readIssueBySlug(slug);
}

const readLibraryAlbums = unstable_cache(async (): Promise<LibraryAlbum[]> => {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("recommendations").select("albums(id, title, artist, cover_url, manual_cover_url, musicbrainz_release_group_id, cover_fallback_url, release_date, release_year, tags), issues(slug, issue_number, published_at)");
  if (error) throw error;
  const getIssue = (row: (typeof data extends (infer Item)[] | null ? Item : never)) => (Array.isArray(row.issues) ? row.issues[0] : row.issues) as unknown as Pick<DbIssue, "slug" | "issue_number" | "published_at"> | null;
  const ordered = [...(data ?? [])].sort((a, b) => new Date(getIssue(a)?.published_at ?? 0).getTime() - new Date(getIssue(b)?.published_at ?? 0).getTime());
  const result = new Map<string, LibraryAlbum>();
  ordered.forEach(row => {
    const album = row.albums as unknown as DbAlbum | null;
    const issue = getIssue(row);
    if (!album || !issue || result.has(album.id)) return;
    result.set(album.id, { album:{ id:album.id, title:album.title, artist:album.artist, releaseDate:album.release_date, releaseYear:album.release_year, tags:album.tags ?? [], cover:{ manualCoverUrl:album.manual_cover_url, musicbrainzReleaseGroupId:album.musicbrainz_release_group_id, fallbackUrl:album.cover_fallback_url, legacyCoverUrl:album.cover_url } }, issueSlug:issue.slug, issueNumber:`#${String(issue.issue_number).padStart(3, "0")}`, issueDate:issueDate(issue.published_at), publishedAt:issue.published_at });
  });
  return [...result.values()];
}, ["published-album-library"], { tags: ["issues", "library"] });

export async function getLibraryAlbums(): Promise<LibraryAlbum[]> {
  await requireUser();
  return readLibraryAlbums();
}

export async function getActivePreferenceProfile(): Promise<PreferenceProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("preference_profiles").select("profile_text, profile_json, version, created_at").eq("is_active", true).order("version", { ascending:false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? { profileText:data.profile_text, profileJson:data.profile_json as Record<string, unknown> | null, version:data.version, createdAt:data.created_at } : null;
}
