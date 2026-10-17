import type { ImportedAlbum } from "./exchange";
import type { DuplicateCheck } from "./import-dedupe";
export type EditorialIssue = { id:string; slug:string; issue_number:number; title:string; subtitle:string | null; editorial:string | null; published_at:string; status:"draft" | "published"; updated_at:string };
export type EditorialAlbum = { id:string; title:string; artist:string; release_year:number; release_date:string | null; tags:string[]; cover_url:string | null; cover_fallback_url:string | null; manual_cover_url:string | null; musicbrainz_release_group_id:string | null; external_urls:Record<string,string | null>; updated_at:string };
export type EditorialRecommendation = { id:string; issue_id:string; album_id:string; recommendation_reason:string; review_summary:string; source_refs:ImportedAlbum["review_sources"]; recommendation_type:ImportedAlbum["recommendation_type"]; display_order:number; updated_at:string };
export type EditorialWorkspace = { issues:EditorialIssue[]; albums:EditorialAlbum[]; recommendations:EditorialRecommendation[] };
export type EditorialPreview = { schema_version:string; issue:{ issue_number:number; publish_date:string; title:string }; albums:ImportedAlbum[]; warnings:string[]; checks:DuplicateCheck[]; fingerprint:string; target:EditorialIssue | null; originalCount:number; minimum:number };
