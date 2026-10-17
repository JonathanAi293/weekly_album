"use client";
/* eslint-disable @next/next/no-img-element -- Device-selected cover previews use temporary blob URLs. */
import { useCallback,useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { AlbumEntryFields } from "./AlbumEntryFields";
import { blankAlbum,editorialRequest,libraryAlbum } from "@/lib/editorial-client";
import { ImportReview } from "./ImportReview";
import { EditorialManager } from "./EditorialManager";
import type { ImportedAlbum } from "@/lib/exchange";
import type { EditorialWorkspace,EditorialPreview } from "@/lib/editorial-types";
import type { ImportDecision } from "@/lib/import-dedupe";

function DevicePreview({file}:{file:File}) {
  const img=useRef<HTMLImageElement>(null);
  useEffect(()=>{const url=URL.createObjectURL(file);if(img.current)img.current.src=url;return()=>URL.revokeObjectURL(url);},[file]);
  return <img ref={img} className="editorial-device-preview" alt="待上传封面预览"/>;
}
type Draft={key:string; album:ImportedAlbum; libraryId:string; query:string; file:File|null};
const draft=():Draft=>({key:crypto.randomUUID(),album:blankAlbum(),libraryId:"",query:"",file:null});

export function EditorialDesk() {
  const router=useRouter();
  const [tab,setTab]=useState<"json"|"form"|"manage">("json");
  const [mode,setMode]=useState<"full"|"append"|"create">("full");
  const [workspace,setWorkspace]=useState<EditorialWorkspace|null>(null);
  const [targetId,setTargetId]=useState("");
  const [raw,setRaw]=useState("");
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [issue,setIssue]=useState({issue_number:0,publish_date:new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),title:"",subtitle:"",intro:""});
  const [preview,setPreview]=useState<EditorialPreview|null>(null),[decisions,setDecisions]=useState<ImportDecision[]>([]);
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false);
  const [uploads,setUploads]=useState<Array<{albumId:string;title:string;file:File}>>([]);
  const form=useRef<HTMLFormElement>(null);
  const applyWorkspace=useCallback((data:EditorialWorkspace)=>{
    setWorkspace(data);setTargetId(current=>current||data.issues[0]?.id||"");
    setIssue(current=>({...current,issue_number:current.issue_number||Math.max(0,...data.issues.map(i=>i.issue_number))+1}));
  },[]);
  async function reload() {
    const response=await fetch("/api/admin/editorial",{cache:"no-store"}); const data=await response.json();
    if(!response.ok)throw new Error(data.error??"无法读取编辑资料。");
    applyWorkspace(data);
  }
  useEffect(()=>{let active=true;void fetch("/api/admin/editorial",{cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error??"无法读取编辑资料。");return data as EditorialWorkspace;}).then(data=>{if(active)applyWorkspace(data);}).catch(error=>{if(active)setMessage(error.message);});return()=>{active=false;};},[applyWorkspace]);
  useEffect(()=>{
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    const link=(event:MouseEvent)=>{const a=(event.target as Element).closest?.("a[href]");if(a&&!a.getAttribute("href")?.startsWith("#")&&!window.confirm("有尚未保存的内容，确认离开吗？")){event.preventDefault();event.stopPropagation();}};
    window.addEventListener("beforeunload",warn);document.addEventListener("click",link,true);
    return()=>{window.removeEventListener("beforeunload",warn);document.removeEventListener("click",link,true);};
  },[dirty]);
  function change(){setPreview(null);setDecisions([]);setDirty(true);setMessage("");}
  function switchTab(next:typeof tab){if(busy||(dirty&&!window.confirm("切换入口会清空尚未保存的输入，继续吗？")))return;setTab(next);setMode(next==="json"?"full":"append");setRaw("");setDrafts([draft()]);setPreview(null);setDecisions([]);setDirty(false);setMessage("");}
  function switchMode(next:typeof mode){if(busy||(dirty&&!window.confirm("切换导入模式会清空尚未保存的输入，继续吗？")))return;setMode(next);setPreview(null);setDecisions([]);setRaw("");setDrafts([draft()]);setDirty(false);setMessage("");}
  function updateDraft(index:number,next:Partial<Draft>){change();setDrafts(current=>current.map((d,i)=>i===index?{...d,...next}:d));}
  const target=workspace?.issues.find(i=>i.id===targetId);
  const currentEntries=workspace?.recommendations.filter(r=>r.issue_id===targetId).sort((a,b)=>a.display_order-b.display_order)??[];
  function inputRaw() {
    if(tab==="json")return raw;
    return JSON.stringify(mode==="create"?{schema_version:"friday-records-v2",issue,albums:drafts.map(d=>d.album)}:{schema_version:"friday-records-albums-v1",albums:drafts.map(d=>d.album)});
  }
  async function check() {
    if(tab==="form"&&form.current){
      for(const input of form.current.querySelectorAll<HTMLInputElement>("input:invalid,textarea:invalid")){let parent=input.closest("details");while(parent){parent.open=true;parent=parent.parentElement?.closest("details")??null;}}
      if(!form.current.reportValidity())return;
    }
    setBusy(true);setMessage("");setPreview(null);setDecisions([]);
    try {
      if(mode==="full") {
        const result=await editorialRequest<{payload:Omit<EditorialPreview,"checks"|"fingerprint"|"target"|"originalCount"|"minimum">;checks:EditorialPreview["checks"];fingerprint:string}>({action:"preview",raw:inputRaw()},"/api/admin/import");
        setPreview({...result.payload,checks:result.checks,fingerprint:result.fingerprint,target:null,originalCount:0,minimum:2});
      } else setPreview(await editorialRequest<EditorialPreview>({action:"preview",mode,raw:inputRaw(),issueId:mode==="append"?targetId:undefined}));
    } catch(error){setMessage(error instanceof Error?error.message:"无法预览。");}
    finally{setBusy(false);}
  }
  async function upload(albumId:string,file:File){const data=new FormData();data.append("file",file);const response=await fetch(`/api/admin/albums/${albumId}/cover/upload`,{method:"POST",body:data});const result=await response.json();if(!response.ok)throw new Error(result.error??"封面上传失败。");}
  async function save() {
    if(!preview)return;
    setBusy(true);setMessage("");
    try {
      let savedId:string;
      if(mode==="full"){const result=await editorialRequest<{issueId:string}>({action:"confirm",raw:inputRaw(),decisions,fingerprint:preview.fingerprint},"/api/admin/import");savedId=result.issueId;}
      else {
        const result=await editorialRequest<{issue_id:string;albums:Array<{index:number;album_id:string;created:boolean}>}>({action:"confirm",mode,raw:inputRaw(),issueId:mode==="append"?targetId:undefined,decisions,fingerprint:preview.fingerprint,issueVersion:preview.target?.updated_at});savedId=result.issue_id;
        const failed:typeof uploads=[];
        for(const item of result.albums){const d=drafts[item.index];if(tab==="form"&&d?.file){if(!item.created)continue;try{await upload(item.album_id,d.file);}catch{failed.push({albumId:item.album_id,title:d.album.title,file:d.file});}}}
        setUploads(failed);
      }
      setPreview(null);setDecisions([]);setDirty(false);setRaw("");setDrafts([draft()]);setTargetId(savedId);
      if(mode==="create")setIssue(current=>({...current,title:"",subtitle:"",intro:"",issue_number:current.issue_number+1}));
      setMessage(mode==="create"?"已保存草稿。可进入「编辑栏目」检查后发布。":"保存完成，原有专栏内容和个人反馈均保留。");
      try{await reload();}catch{setMessage("已保存成功，但资料列表刷新失败。请刷新页面；不要重复提交。");}
      router.refresh();
    } catch(error){setMessage(error instanceof Error?error.message:"保存失败。");}
    finally{setBusy(false);}
  }
  return <section className="exchange-section editorial-desk">
    <div className="eyebrow">01 · Editorial desk</div><h2 className="serif">写入唱片室</h2>
    <div className="exchange-options" aria-label="录入方式">{([["json","JSON 导入"],["form","表单录入"],["manage","编辑栏目"]] as const).map(([key,label])=><button key={key} className={`status ${tab===key?"active":""}`} type="button" disabled={busy} onClick={()=>switchTab(key)}>{label}</button>)}</div>
    {tab==="manage" ? workspace?<EditorialManager workspace={workspace} initialIssueId={targetId} onReload={reload} onDirty={setDirty}/>:<p role="status">正在读取编辑资料…</p> : <>
      <div className="exchange-options" aria-label="导入目标">{(tab==="json"?[["full","导入完整一期（默认）"],["append","向已有一期追加"]]:[["append","加入已有专栏"],["create","新建草稿专栏"]]).map(([key,label])=><button type="button" key={key} className={`status ${mode===key?"active":""}`} disabled={busy} onClick={()=>switchMode(key as typeof mode)}>{label}</button>)}</div>
      {mode==="append"&&<><label>选择目标专栏<select className="exchange-select" disabled={busy||!workspace} value={targetId} onChange={e=>{change();setTargetId(e.target.value);}}><option value="">请选择期数…</option>{workspace?.issues.map(i=><option key={i.id} value={i.id}>第 {i.issue_number} 期 · {i.title} · {i.status==="draft"?"草稿":"已发布"}</option>)}</select></label>
        {target&&<div className="editorial-existing"><p>当前 {currentEntries.length} 张 · {target.status==="published"?"追加后立即更新线上内容":"追加不会自动发布草稿"}</p><details><summary>查看本期已有专辑</summary>{currentEntries.map(r=><p key={r.id}>{r.display_order}. {workspace?.albums.find(a=>a.id===r.album_id)?.title}</p>)}</details></div>}
      </>}
      {tab==="json"?<><p className="reason">{mode==="full"?"保持 friday-records-v1/v2 格式，含 issue 和 albums；每期 2–14 张。":"使用 friday-records-albums-v1，仅含 albums，不要填写 issue；每次 1–14 张。"}</p><textarea className="exchange-textarea" disabled={busy} value={raw} aria-label="专辑 JSON 内容" placeholder={mode==="full"?"粘贴完整一期 JSON…":'{"schema_version":"friday-records-albums-v1","albums":[…]}'} onChange={e=>{change();setRaw(e.target.value);}}/></>:<form ref={form} onSubmit={e=>{e.preventDefault();void check();}}><fieldset disabled={busy}>
        {mode==="create"&&<div className="editorial-fields"><div className="editorial-pair"><label>期号 *<input required type="number" min="1" value={issue.issue_number||""} onChange={e=>{change();setIssue({...issue,issue_number:Number(e.target.value)});}}/></label><label>发布日期 *<input required type="date" value={issue.publish_date} onChange={e=>{change();setIssue({...issue,publish_date:e.target.value});}}/></label></div><label>专栏标题 *<input required value={issue.title} onChange={e=>{change();setIssue({...issue,title:e.target.value});}}/></label><label>副标题<input value={issue.subtitle} onChange={e=>{change();setIssue({...issue,subtitle:e.target.value});}}/></label><label>开篇文字<textarea value={issue.intro} onChange={e=>{change();setIssue({...issue,intro:e.target.value});}}/></label></div>}
        {drafts.map((d,index)=><details className="editorial-album" key={d.key} open><summary>{index+1}. {d.album.title||"新唱片"}{d.libraryId?" · 已有记录":""}</summary>
          <label>搜索唱片库<input value={d.query} placeholder="输入专辑名或艺术家" onChange={e=>updateDraft(index,{query:e.target.value})}/></label>
          {d.query.trim()&&<div className="editorial-search">{workspace?.albums.filter(a=>`${a.title} ${a.artist}`.toLowerCase().includes(d.query.trim().toLowerCase())).slice(0,8).map(a=><button className="auth-link" key={a.id} type="button" onClick={()=>updateDraft(index,{album:libraryAlbum(a),libraryId:a.id,query:"",file:null})}>{a.title} — {a.artist} ({a.release_year})</button>)}</div>}
          {d.libraryId&&<button className="auth-link" type="button" onClick={()=>updateDraft(index,{libraryId:"",album:blankAlbum()})}>取消复用，填写新唱片</button>}
          <AlbumEntryFields value={d.album} onChange={album=>updateDraft(index,{album})} metadataLocked={!!d.libraryId}/>
          {!d.libraryId&&<label>从设备选择平面封面（可选）<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0]??null;if(file&&(file.size>5*1024*1024||!file.size||!["image/jpeg","image/png","image/webp"].includes(file.type))){setMessage("封面请选择 5MB 以内的 JPG、PNG 或 WebP。HEIC 请先转换。");e.target.value="";return;}updateDraft(index,{file});}}/>{d.file&&<DevicePreview file={d.file}/>}</label>}
          <p className="mobile-note">封面会在唱片保存后上传。若查重后复用旧唱片，保留旧封面，不覆盖。</p>
          {message.startsWith(`第 ${index+1} 张`)&&<p role="alert" className="exchange-message">{message}</p>}
          <button className="auth-link" type="button" onClick={()=>{change();setDrafts(current=>current.filter((_,i)=>i!==index));}}>移除此项</button>
        </details>)}
        <div className="auth-actions"><button className="status" type="button" disabled={drafts.length>=14} onClick={()=>{change();setDrafts([...drafts,draft()]);}}>再加一张</button></div>
      </fieldset></form>}
      {!preview&&<div className="editorial-save"><button className="status active" type="button" disabled={busy||(mode==="append"&&!targetId)||(tab==="json"&&!raw.trim())} onClick={()=>void check()}>{busy?"处理中…":"检查并预览"}</button></div>}
      {preview&&<ImportReview preview={preview} decisions={decisions} onDecide={d=>setDecisions(current=>[...current.filter(c=>c.index!==d.index),d])} disabled={busy} onSave={()=>void save()}/>}
    </>}
    {message&&<p className="exchange-message" role="status">{message}</p>}
    {uploads.length>0&&<div className="import-dedupe"><p>唱片已经保存，以下封面上传失败；无需重新导入。</p>{uploads.map(item=><button className="status" type="button" key={item.albumId} disabled={busy} onClick={async()=>{setBusy(true);try{await upload(item.albumId,item.file);setUploads(current=>current.filter(u=>u.albumId!==item.albumId));}catch(error){setMessage(error instanceof Error?error.message:"上传失败。");}finally{setBusy(false);}}}>重试上传 · {item.title}</button>)}</div>}
  </section>;
}
