import { NextResponse } from "next/server";
import { isValidRating } from "@/lib/rating";
import { createClient } from "@/lib/supabase/server";
import { invalidateFeedbackData } from "@/lib/cache-invalidation";

const statuses = ["want_to_listen", "listened", "not_interested"] as const;
const ratingStatuses = ["pending", "rated", "no_rating"] as const;

export async function POST(request: Request) {
  let body: { albumId?: unknown; rating?: unknown; ratingStatus?: unknown; status?: unknown; comment?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error:"Invalid JSON" }, { status:400 }); }
  if (typeof body.albumId !== "string") return NextResponse.json({ error:"albumId is required" }, { status:400 });
  const rating = body.rating === null || body.rating === undefined ? null : Number(body.rating);
  if (rating !== null && !isValidRating(rating)) return NextResponse.json({ error:"rating must be from 1.0 to 10.0 in 0.5 increments" }, { status:400 });
  if (body.ratingStatus !== undefined && !ratingStatuses.includes(body.ratingStatus as (typeof ratingStatuses)[number])) return NextResponse.json({ error:"Invalid rating status" }, { status:400 });
  if (body.ratingStatus === "no_rating" && rating !== null) return NextResponse.json({ error:"no_rating must not include a numeric rating" }, { status:400 });
  if (body.ratingStatus === "rated" && !isValidRating(rating)) return NextResponse.json({ error:"rated requires a numeric rating" }, { status:400 });
  if (body.ratingStatus === "pending" && rating !== null) return NextResponse.json({ error:"pending must not include a numeric rating" }, { status:400 });
  if (body.status !== null && body.status !== undefined && !statuses.includes(body.status as (typeof statuses)[number])) return NextResponse.json({ error:"Invalid listening status" }, { status:400 });
  if (body.comment !== null && body.comment !== undefined && (typeof body.comment !== "string" || body.comment.length > 1200)) return NextResponse.json({ error:"comment must be at most 1200 characters" }, { status:400 });
  const supabase = await createClient(); const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  const { data:current, error:readError } = await supabase.from("feedback").select("listening_status, rating, rating_status, review").eq("user_id", user.id).eq("album_id", body.albumId).maybeSingle();
  if (readError) return NextResponse.json({ error:readError.message }, { status:500 });
  const has = (key: keyof typeof body) => Object.prototype.hasOwnProperty.call(body, key);
  const patch: { listening_status?: (typeof statuses)[number] | null; rating?:number | null; rating_status?: (typeof ratingStatuses)[number]; review?:string | null } = {};
  if (has("status")) patch.listening_status = body.status as (typeof statuses)[number] | null;
  if (has("comment")) patch.review = body.comment as string | null;
  if (has("rating") || has("ratingStatus")) {
    const nextRatingStatus = has("ratingStatus") ? body.ratingStatus as (typeof ratingStatuses)[number] : rating === null ? "pending" : "rated";
    const nextRating = nextRatingStatus === "rated" ? (has("rating") ? rating : current?.rating === null || current?.rating === undefined ? null : Number(current.rating)) : null;
    if (nextRatingStatus === "rated" && !isValidRating(nextRating)) return NextResponse.json({ error:"rated requires a numeric rating" }, { status:400 });
    patch.rating = nextRating;
    patch.rating_status = nextRatingStatus;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error:"No feedback fields supplied" }, { status:400 });
  const query = current
    ? supabase.from("feedback").update(patch).eq("user_id", user.id).eq("album_id", body.albumId)
    : supabase.from("feedback").insert({ user_id:user.id, album_id:body.albumId, ...patch });
  const { data, error } = await query.select("album_id, listening_status, rating, rating_status, review, updated_at, status_updated_at").single();
  if (error) return NextResponse.json({ error:error.message }, { status:500 });
  invalidateFeedbackData();
  return NextResponse.json({ ok:true, feedback:{ albumId:data.album_id, status:data.listening_status, rating:data.rating === null ? null : Number(data.rating), ratingStatus:data.rating_status, comment:data.review ?? "", updatedAt:data.updated_at, statusUpdatedAt:data.status_updated_at } });
}
