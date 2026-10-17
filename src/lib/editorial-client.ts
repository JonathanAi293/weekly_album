import type { EditorialAlbum } from "./editorial-types";
import type { ImportedAlbum } from "./exchange";
export function blankAlbum():ImportedAlbum {return {title:"",artist:"",release_year:new Date().getFullYear(),release_date:null,tags:[],recommendation_type:"taste_match",recommendation_reason:"",review_summary:"",review_sources:[],cover:{musicbrainz_release_group_id:null,fallback_url:null},links:{}};}
export function libraryAlbum(a:EditorialAlbum):ImportedAlbum {return {...blankAlbum(),title:a.title,artist:a.artist,release_year:a.release_year,release_date:a.release_date,tags:a.tags,cover_url:a.cover_url,cover:{musicbrainz_release_group_id:a.musicbrainz_release_group_id,fallback_url:a.cover_fallback_url},links:a.external_urls};}
export async function editorialRequest<T>(body:Record<string,unknown>,url="/api/admin/editorial"):Promise<T> {
  const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const result=await response.json(); if(!response.ok)throw new Error(result.error??"操作失败。"); return result;
}
