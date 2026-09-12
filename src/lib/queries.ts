import { redirect } from "next/navigation";
import type { FeedbackRecord } from "./feedback";
import type { Album, Issue, IssueListItem, LibraryAlbum, PreferenceProfile } from "./models";
import { isSupabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/server";

type SourceRef = { name?: string; url?: string };
type DbAlbum = { id:string; title:string; artist:string; cover_url:string | null; release_year:number; tags:string[] | null };
type DbIssue = { id:string; slug:string; issue_number:number; title:string; editorial:string | null; published_at:string; status?:string };
type DbRecommendation = { display_order:number; recommendation_type:"taste_match" | "exploration"; recommendation_reason:string; review_summary:string; source_refs:SourceRef[] | null; albums:DbAlbum | null };

function issueDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} · Friday`;
}

function asAlbum(row: DbAlbum, recommendation: DbRecommendation): Album {
  const source = recommendation.source_refs?.[0];
  return {
    id:row.id, title:row.title, artist:row.artist, releaseYear:row.release_year, tags:row.tags ?? [], cover:row.cover_url,
    type:recommendation.recommendation_type === "exploration" ? "探索推荐" : "口味命中",
    reason:recommendation.recommendation_reason, review:recommendation.review_summary,
    source:source?.name ?? "编辑资料", sourceUrl:source?.url ?? null,
  };
}

function asIssue(row: DbIssue & { recommendations?: DbRecommendation[] }): Issue {
  const recommendations = (row.recommendations ?? []).filter((item): item is DbRecommendation & { albums:DbAlbum } => Boolean(item.albums)).sort((a, b) => a.display_order - b.display_order);
  return { id:row.id, slug:row.slug, number:`#${String(row.issue_number).padStart(3, "0")}`, date:issueDate(row.published_at), title:row.title, intro:row.editorial ?? "", albums:recommendations.map(item => asAlbum(item.albums, item)) };
}

export async function requireUser() {
  if (!isSupabaseConfigured()) redirect("/login?reason=config");
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

export async function getFeedbackForCurrentUser(): Promise<FeedbackRecord[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from("feedback").select("album_id, listening_status, rating, rating_status, review, updated_at, status_updated_at").eq("user_id", user.id);
  if (error) throw error;
  return (data ?? []).map(row => ({ albumId:row.album_id, status:row.listening_status, rating:row.rating === null ? null : Number(row.rating), ratingStatus:row.rating_status, comment:row.review ?? "", updatedAt:row.updated_at, statusUpdatedAt:row.status_updated_at }));
}

export async function getCurrentIssue() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("issues").select("id, slug, issue_number, title, editorial, published_at, recommendations(display_order, recommendation_type, recommendation_reason, review_summary, source_refs, albums(id, title, artist, cover_url, release_year, tags))").eq("status", "published").order("published_at", { ascending:false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? asIssue(data as unknown as DbIssue & { recommendations:DbRecommendation[] }) : null;
}

export async function getIssues(): Promise<IssueListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("issues").select("id, slug, issue_number, title, editorial, published_at, recommendations(id)").eq("status", "published").order("published_at", { ascending:false });
  if (error) throw error;
  return (data ?? []).map(row => ({ id:row.id, slug:row.slug, number:`#${String(row.issue_number).padStart(3, "0")}`, date:issueDate(row.published_at), title:row.title, intro:row.editorial ?? "", albumCount:row.recommendations?.length ?? 0 }));
}

export async function getIssueBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("issues").select("id, slug, issue_number, title, editorial, published_at, recommendations(display_order, recommendation_type, recommendation_reason, review_summary, source_refs, albums(id, title, artist, cover_url, release_year, tags))").eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) throw error;
  return data ? asIssue(data as unknown as DbIssue & { recommendations:DbRecommendation[] }) : null;
}

export async function getLibraryAlbums(): Promise<LibraryAlbum[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recommendations").select("display_order, recommendation_type, recommendation_reason, review_summary, source_refs, albums(id, title, artist, cover_url, release_year, tags), issues(id, slug, issue_number, published_at)");
  if (error) throw error;
  const getIssue = (row: (typeof data extends (infer Item)[] | null ? Item : never)) => (Array.isArray(row.issues) ? row.issues[0] : row.issues) as unknown as Pick<DbIssue, "slug" | "issue_number" | "published_at"> | null;
  const ordered = [...(data ?? [])].sort((a, b) => new Date(getIssue(a)?.published_at ?? 0).getTime() - new Date(getIssue(b)?.published_at ?? 0).getTime());
  const result = new Map<string, LibraryAlbum>();
  ordered.forEach(row => {
    const album = row.albums as unknown as DbAlbum | null;
    const issue = getIssue(row);
    if (!album || !issue || result.has(album.id)) return;
    result.set(album.id, { album:asAlbum(album, row as unknown as DbRecommendation), issueSlug:issue.slug, issueNumber:`#${String(issue.issue_number).padStart(3, "0")}`, issueDate:issueDate(issue.published_at), publishedAt:issue.published_at });
  });
  return [...result.values()];
}

export async function getActivePreferenceProfile(): Promise<PreferenceProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("preference_profiles").select("profile_text, profile_json, version, created_at").eq("is_active", true).order("version", { ascending:false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? { profileText:data.profile_text, profileJson:data.profile_json as Record<string, unknown> | null, version:data.version, createdAt:data.created_at } : null;
}
