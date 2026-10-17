"use client";
import { useState } from "react";
import type { ImportedAlbum } from "@/lib/exchange";
export function AlbumEntryFields({value,onChange,metadataLocked=false,onlyMetadata=false}: {value:ImportedAlbum; onChange:(v:ImportedAlbum)=>void; metadataLocked?:boolean; onlyMetadata?:boolean}) {
  const [tagText,setTagText]=useState("");
  function set<K extends keyof ImportedAlbum>(key:K,next:ImportedAlbum[K]) {onChange({...value,[key]:next});}
  return <div className="editorial-fields">
    <fieldset disabled={metadataLocked}><legend>唱片资料{metadataLocked?"（复用已有记录，不在此修改）":""}</legend>
      <label>专辑名 *<input required value={value.title} onChange={e=>set("title",e.target.value)} /></label>
      <label>艺术家 *<input required value={value.artist} onChange={e=>set("artist",e.target.value)} /></label>
      <div className="editorial-pair"><label>发行年份 *<input type="number" required min="1900" max="2100" inputMode="numeric" value={value.release_year||""} onChange={e=>set("release_year",Number(e.target.value))} /></label><label>准确发行日期（可选）<input type="date" value={value.release_date??""} onChange={e=>set("release_date",e.target.value||null)} /></label></div>
      <label>风格标签 *<input value={tagText} onChange={e=>setTagText(e.target.value)} placeholder="输入标签，点击添加" /></label><button className="status" type="button" onClick={()=>{const tags=tagText.split(/[,，、]/).map(s=>s.trim()).filter(Boolean);if(tags.length){set("tags",Array.from(new Set([...value.tags,...tags])));setTagText("");}}}>添加标签</button>
      <div className="tags">{value.tags.map(tag=><button className="tag" type="button" key={tag} aria-label={`移除标签 ${tag}`} onClick={()=>set("tags",value.tags.filter(t=>t!==tag))}>{tag} ×</button>)}</div>
      <p className="mobile-note">至少添加一个标签。只知道年份时，请将日期留空。</p>
      <details><summary>封面与试听链接</summary><label>平面封面图片 URL<input type="url" value={value.cover.fallback_url??""} onChange={e=>set("cover",{...value.cover,fallback_url:e.target.value||null})} /></label><label>MusicBrainz Release Group ID<input value={value.cover.musicbrainz_release_group_id??""} onChange={e=>set("cover",{...value.cover,musicbrainz_release_group_id:e.target.value||null})} /></label>{["spotify","apple_music","bandcamp","musicbrainz"].map(platform=><label key={platform}>{platform}<input type="url" value={value.links[platform]??""} onChange={e=>set("links",{...value.links,[platform]:e.target.value||null})} /></label>)}</details>
    </fieldset>
    {!onlyMetadata&&<><label>推荐类别 *<select value={value.recommendation_type} onChange={e=>set("recommendation_type",e.target.value as ImportedAlbum["recommendation_type"])}><option value="taste_match">口味命中</option><option value="exploration">探索推荐</option></select></label>
      <details open><summary>专栏文字与来源（可选）</summary><label>为什么值得听<textarea value={value.recommendation_reason} onChange={e=>set("recommendation_reason",e.target.value)} /></label><label>媒体评价摘要<textarea value={value.review_summary} onChange={e=>set("review_summary",e.target.value)} /></label>
        {value.review_sources.map((source,index)=><div className="editorial-source" key={index}><label>来源名称<input required value={source.name} onChange={e=>set("review_sources",value.review_sources.map((s,i)=>i===index?{...s,name:e.target.value}:s))} /></label><label>来源链接<input required type="url" value={source.url} onChange={e=>set("review_sources",value.review_sources.map((s,i)=>i===index?{...s,url:e.target.value}:s))} /></label><button className="auth-link" type="button" onClick={()=>set("review_sources",value.review_sources.filter((_,i)=>i!==index))}>移除此来源</button></div>)}
        <button className="status" type="button" onClick={()=>set("review_sources",[...value.review_sources,{name:"",url:""}])}>添加来源</button><p className="mobile-note">有媒体摘要时必须添加来源；没有媒体资料可以都留空。</p>
      </details></>}
  </div>;
}
