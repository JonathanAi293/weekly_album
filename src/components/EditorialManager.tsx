"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlbumEntryFields } from "./AlbumEntryFields";
import { ManualCoverEditor } from "./ManualCoverEditor";
import { editorialRequest,libraryAlbum } from "@/lib/editorial-client";
import type { EditorialWorkspace,EditorialIssue,EditorialAlbum,EditorialRecommendation } from "@/lib/editorial-types";
import type { ImportedAlbum } from "@/lib/exchange";

export function EditorialManager({workspace,initialIssueId,onReload,onDirty}:{workspace:EditorialWorkspace;initialIssueId:string;onReload:()=>Promise<void>;onDirty:(d:boolean)=>void}) {
  const [issueId,setIssueId]=useState(initialIssueId||workspace.issues[0]?.id||"");
  const [edit,setEdit]=useState<"issue"|string>("issue");
  const [dirty,setDirty]=useState(false);
  const issue=workspace.issues.find(i=>i.id===issueId);
  const entries=workspace.recommendations.filter(r=>r.issue_id===issueId).sort((a,b)=>a.display_order-b.display_order);
  function select(id:string,entry="issue"){if(dirty&&!window.confirm("有尚未保存的修改，确认切换吗？"))return;setIssueId(id);setEdit(entry);setDirty(false);onDirty(false);}
  function mark(d:boolean){setDirty(d);onDirty(d);}
  return <div className="editorial-manager"><label>选择要编辑的专栏<select className="exchange-select" value={issueId} onChange={e=>select(e.target.value)}><option value="">请选择期数…</option>{workspace.issues.map(i=><option key={i.id} value={i.id}>第 {i.issue_number} 期 · {i.title} · {i.status==="draft"?"草稿":"已发布"}</option>)}</select></label>
    {issue&&<><div className="auth-actions"><button className="status" type="button" onClick={()=>select(issueId)}>专栏信息／发布</button></div>
      <details open><summary>本期条目 · {entries.length} 张</summary>{entries.map(r=>{const a=workspace.albums.find(a=>a.id===r.album_id);return a?<div className="editorial-entry" key={r.id}><span>{r.display_order}. {a.title} — {a.artist}</span><button className="auth-link" type="button" onClick={()=>select(issueId,r.id)}>编辑本期文字</button><button className="auth-link" type="button" onClick={()=>select(issueId,`album:${a.id}`)}>共享唱片资料</button></div>:null;})}</details>
      {edit==="issue"?<IssueEditor key={`${issue.id}:${issue.updated_at}`} issue={issue} onReload={onReload} onDirty={mark}/>:edit.startsWith("album:")?(()=>{const album=workspace.albums.find(a=>a.id===edit.slice(6));return album?<RecordEditor key={`${album.id}:${album.updated_at}`} issue={issue} album={album} onReload={onReload} onDirty={mark}/>:null;})():(()=>{const rec=entries.find(r=>r.id===edit),album=workspace.albums.find(a=>a.id===rec?.album_id);return rec&&album?<RecordEditor key={`${rec.id}:${rec.updated_at}`} issue={issue} album={album} recommendation={rec} onReload={onReload} onDirty={mark}/>:null;})()}
    </>}
  </div>;
}
function IssueEditor({issue,onReload,onDirty}:{issue:EditorialIssue;onReload:()=>Promise<void>;onDirty:(d:boolean)=>void}) {
  const router=useRouter();const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [value,setValue]=useState({title:issue.title,subtitle:issue.subtitle??"",intro:issue.editorial??"",publish_date:issue.published_at.slice(0,10),status:issue.status});
  function set<K extends keyof typeof value>(key:K,next:typeof value[K]){onDirty(true);setValue({...value,[key]:next});}
  return <form className="editorial-fields" onSubmit={async e=>{e.preventDefault();if((issue.status==="published"||value.status==="published")&&!window.confirm(value.status==="published"?"确认保存并更新线上专栏？":"确认将此专栏转为草稿，从线上隐藏？"))return;setBusy(true);try{await editorialRequest({action:"edit",kind:"issue",id:issue.id,version:issue.updated_at,value});onDirty(false);setMessage("已保存专栏信息。");try{await onReload();}catch{setMessage("保存成功，请刷新资料列表，不要重复提交。");}router.refresh();}catch(error){setMessage(error instanceof Error?error.message:"保存失败。");}finally{setBusy(false);}}}>
    <h3 className="serif">专栏信息 · 第 {issue.issue_number} 期</h3><p className="mobile-note">期号与 URL 保持不变。发布草稿会使其在网站上可见。</p><fieldset disabled={busy}>
      <label>标题 *<input required value={value.title} onChange={e=>set("title",e.target.value)}/></label><label>副标题<input value={value.subtitle} onChange={e=>set("subtitle",e.target.value)}/></label><label>发布日期 *<input required type="date" value={value.publish_date} onChange={e=>set("publish_date",e.target.value)}/></label><label>开篇文字<textarea value={value.intro} onChange={e=>set("intro",e.target.value)}/></label><label>发布状态<select value={value.status} onChange={e=>set("status",e.target.value as typeof value.status)}><option value="draft">草稿 · 仅编辑台可见</option><option value="published">已发布 · 网站可见</option></select></label>
      <button className="status active" type="submit">{busy?"保存中…":"保存专栏信息"}</button>
    </fieldset>{message&&<p role="status" className="exchange-message">{message}</p>}
  </form>;
}
function RecordEditor({issue,album,recommendation,onReload,onDirty}:{issue:EditorialIssue;album:EditorialAlbum;recommendation?:EditorialRecommendation;onReload:()=>Promise<void>;onDirty:(d:boolean)=>void}) {
  const router=useRouter();const [busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[message,setMessage]=useState("");
  const [value,setValue]=useState<ImportedAlbum>(()=>({...libraryAlbum(album),...(recommendation?{recommendation_reason:recommendation.recommendation_reason,review_summary:recommendation.review_summary,review_sources:recommendation.source_refs,recommendation_type:recommendation.recommendation_type}:{})}));
  return <div><form className="editorial-fields" onSubmit={async e=>{e.preventDefault();if(!recommendation&&!window.confirm("这是全站共享唱片资料。修改将影响所有期数、想听和年度页面，确认保存？"))return;if(recommendation&&issue.status==="published"&&!window.confirm("本期已发布，保存后会立即更新线上文字。确认吗？"))return;setBusy(true);try{await editorialRequest({action:"edit",kind:recommendation?"recommendation":"album",id:recommendation?.id??album.id,version:recommendation?.updated_at??album.updated_at,value});onDirty(false);setDirty(false);setMessage("保存成功，个人反馈未改变。");try{await onReload();}catch{setMessage("保存成功，请刷新资料列表，不要重复提交。");}router.refresh();}catch(error){setMessage(error instanceof Error?error.message:"保存失败。");}finally{setBusy(false);}}}>
    <h3 className="serif">{recommendation?"编辑本期推荐":"编辑共享唱片资料"}</h3><p className="mobile-note">{recommendation?"只修改本期文字、媒体来源和推荐类别。":"名称、年份、标签和自动封面来源会影响全站；不会修改评分、短评和手动封面。"}</p>
    <fieldset disabled={busy}><AlbumEntryFields value={value} onChange={next=>{setValue(next);setDirty(true);onDirty(true);}} metadataLocked={!!recommendation} onlyMetadata={!recommendation}/><button className="status active" type="submit">{busy?"保存中…":"保存修改"}</button></fieldset>{message&&<p role="status" className="exchange-message">{message}</p>}
  </form>{!recommendation&&!dirty&&<div className="editorial-fields"><p className="mobile-note">共享封面单独保存。请先保存其他资料，再上传图片。</p><ManualCoverEditor albumId={album.id} initialUrl={album.manual_cover_url} onSaved={()=>{void onReload().catch(()=>setMessage("封面已保存，请刷新资料列表。"));}}/></div>}</div>;
}
