"use client";
import { AlbumCover } from "./AlbumCover";
import { resolveImport,type ImportDecision } from "@/lib/import-dedupe";
import type { EditorialPreview } from "@/lib/editorial-types";
export function ImportReview({preview,decisions,onDecide,disabled,onSave}: {preview:EditorialPreview; decisions:ImportDecision[]; onDecide:(d:ImportDecision)=>void; disabled:boolean; onSave:()=>void}) {
  let block="",count=0;
  try {count=resolveImport(preview.albums,preview.checks,decisions,{minimum:preview.minimum,targetSlug:preview.target?.slug}).length;} catch(error){block=error instanceof Error?error.message:"请处理重复项。";}
  return <div className="exchange-preview" aria-label="保存预览">
    <h3 className="serif">第 {preview.issue.issue_number} 期 · {preview.issue.title}</h3>
    <p>{preview.target ? `原有 ${preview.originalCount} 张保持不变；本次追加 ${count} 张，合计 ${preview.originalCount+count} 张。` : `本次收录 ${count} 张专辑。`}</p>
    <p className="mobile-note">{preview.target?.status === "published" ? "保存后立即更新线上专栏。" : preview.target ? "目标为草稿，追加后仍是草稿。" : preview.minimum===1 ? "先保存为草稿；可在「编辑栏目」检查并发布。" : "确认后导入并发布完整一期。"}</p>
    {preview.warnings.map((w,i)=><p className="mobile-note" key={i}>{w}</p>)}
    <p className="reason">{preview.checks.filter(c=>!c.matches.length&&!c.internal.length).length} 张新推荐 · {preview.checks.filter(c=>c.matches.some(m=>m.kind==="exact")||c.internal.some(m=>m.kind==="exact")).length} 张明确匹配 · {preview.checks.filter(c=>c.needsDecision).length} 张需确认</p>
    {preview.albums.map((album,index)=>{
      const check=preview.checks[index],decision=decisions.find(d=>d.index===index),exact=check.matches.filter(m=>m.kind==="exact");
      const inTarget=check.matches.some(m=>m.kind==="exact"&&m.album.issues.some(i=>i.slug===preview.target?.slug));
      return <div className={`exchange-album ${decision?.action==="skip"?"import-skipped":""}`} key={index}>
        <AlbumCover className="import-cover" title={album.title} cover={{musicbrainzReleaseGroupId:album.cover.musicbrainz_release_group_id,fallbackUrl:album.cover.fallback_url,legacyCoverUrl:album.cover_url??null}} />
        <span>{index+1}</span><div><b>{album.title}</b><p>{album.artist} · {album.release_year} · {album.tags.join(" / ")}</p>
          {(check.matches.length>0||check.internal.length>0)&&<div className="import-dedupe">
            {check.internal.map(m=><p key={m.index}>与本次第 {m.index+1} 张{m.kind==="exact"?"重复":"疑似相同版本"}。</p>)}
            {check.matches.map(m=><div key={m.album.id}><p>{m.kind==="exact"?"明确匹配":"疑似重复"}：{m.album.title} — {m.album.artist} ({m.album.release_year})</p><p>{m.album.issues.length ? m.album.issues.map(i=>i.status==="published"?<a className="quiet-link" key={i.slug} href={`/issues/${i.slug}#${m.album.id}`} target="_blank" rel="noreferrer">第 {i.issue_number} 期 ↗　</a>:<span key={i.slug}>第 {i.issue_number} 期（草稿）　</span>):"已有唱片，尚未推荐"}</p>{m.album.feedback&&<p>个人记录：{({listened:"已听",want_to_listen:"想听",not_interested:"不感兴趣"} as Record<string,string>)[m.album.feedback.listening_status??""]??"未标记"} · {m.album.feedback.rating_status==="no_rating"?"不评分":m.album.feedback.rating===null?"未评分":`${Number(m.album.feedback.rating).toFixed(1)} 分`}</p>}</div>)}
            {inTarget&&<p>已在目标专栏中，只能跳过；修改原条目请进入「编辑栏目」。</p>}
            <div className="auth-actions"><button className={`status ${decision?.action==="skip"?"active":""}`} disabled={disabled} type="button" onClick={()=>onDecide({index,action:"skip"})}>跳过此项</button>
              {!inTarget&&exact.length<=1&&<button className={`status ${decision?.action==="include"?"active":""}`} disabled={disabled} type="button" onClick={()=>onDecide({index,action:"include",albumId:exact[0]?.album.id})}>{exact.length?"确认重荐，复用记录":check.internal.some(m=>m.kind==="exact")?"保留这一项":"确认是不同专辑"}</button>}
            </div>
            {!inTarget&&check.matches.length>0&&exact.length!==1&&<select className="exchange-select" aria-label={`第 ${index+1} 张选择复用记录`} value={decision?.albumId??""} disabled={disabled} onChange={e=>{if(e.target.value)onDecide({index,action:"include",albumId:e.target.value});}}><option value="">或选择要复用的历史记录…</option>{check.matches.map(m=><option key={m.album.id} value={m.album.id}>{m.album.title} · {m.album.release_year} · {m.album.id.slice(0,8)}</option>)}</select>}
            <p className="mobile-note">{decision?.action==="skip"?"已跳过，不修改原记录。":decision?.action==="include"?"已明确确认。":check.needsDecision?"尚未处理，不会自动放行。":"首次推荐可直接复用，也可以跳过。"}</p>
          </div>}
        </div>
      </div>;
    })}
    {block&&<p role="status" className="exchange-message">{block}</p>}
    <div className="editorial-save"><button className="status active" type="button" disabled={disabled||!!block} onClick={onSave}>{disabled?"保存中…":block?"请先处理上述提示":`确认保存 · ${count} 张`}</button></div>
  </div>;
}
