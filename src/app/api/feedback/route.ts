import { NextResponse } from "next/server";
import { isValidRating } from "@/lib/rating";
import { createClient } from "@/lib/supabase/server";

const statuses = ["want_to_listen", "listened", "not_interested"] as const;
const ratingStatuses = ["pending", "rated", "no_rating"] as const;

export async function POST(request: Request) {
  let body: { albumId?: unknown; rating?: unknown; ratingStatus?: unknown; status?: unknown; comment?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error:"Invalid JSON" }, { status:400 }); }
  if (typeof body.albumId !== "string") return NextResponse.json({ error:"albumId is required" }, { status:400 });
  const rating = body.rating === null || body.rating === undefined ? null : Number(body.rating);
  if (rating !== null && !isValidRating(rating)) return NextResponse.json({ error:"rating must be from 1.0 to 10.0 in 0.5 increments" }, { status:400 });
  if (body.ratingStatus !== null && body.ratingStatus !== undefined && !ratingStatuses.includes(body.ratingStatus as (typeof ratingStatuses)[number])) return NextResponse.json({ error:"Invalid rating status" }, { status:400 });
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
  const nextRatingStatus = has("ratingStatus") ? body.ratingStatus as (typeof ratingStatuses)[number] : current?.rating_status ?? "pending";
  const nextRating = nextRatingStatus === "rated" ? (has("rating") ? rating : current?.rating === null || current?.rating === undefined ? null : Number(current.rating)) : null;
  if (nextRatingStatus === "rated" && !isValidRating(nextRating)) return NextResponse.json({ error:"rated requires a numeric rating" }, { status:400 });
  const row = {
    user_id:user.id, album_id:body.albumId,
    listening_status:has("status") ? body.status as (typeof statuses)[number] | null : current?.listening_status ?? null,
    rating:nextRating,
    rating_status:nextRatingStatus,
    review:has("comment") ? body.comment as string : current?.review ?? null,
  };
  const { data, error } = await supabase.from("feedback").upsert(row, { onConflict:"user_id,album_id" }).select("album_id, listening_status, rating, rating_status, review, updated_at, status_updated_at").single();
  if (error) return NextResponse.json({ error:error.message }, { status:500 });
  return NextResponse.json({ ok:true, feedback:{ albumId:data.album_id, status:data.listening_status, rating:data.rating === null ? null : Number(data.rating), ratingStatus:data.rating_status, comment:data.review ?? "", updatedAt:data.updated_at, statusUpdatedAt:data.status_updated_at } });
}
