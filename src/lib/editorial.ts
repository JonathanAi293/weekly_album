import "server-only";
import { createAdminClient } from "./supabase/admin";
import { getImportCatalog, parseAlbumBatch, parseImportedIssue } from "./exchange";
import { checkDuplicates, resolveImport, type ImportDecision } from "./import-dedupe";
import type { EditorialWorkspace, EditorialIssue, EditorialPreview } from "./editorial-types";

export function canonicalAlbumKey(artist:string,title:string,year:number) {
  return `${artist} ${title}`.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g,"-")+`-${year}`;
}
export async function getEditorialWorkspace():Promise<EditorialWorkspace> {
  const client = createAdminClient();
  async function all(table:string, columns:string) {
    const rows:unknown[] = [];
    for (let start=0;;start+=500) {
      const { data,error } = await client.from(table).select(columns).order("id").range(start,start+499);
      if (error) throw new Error(`无法读取编辑资料：${error.message}`);
      rows.push(...(data ?? []));
      if ((data?.length ?? 0)<500) return rows;
    }
  }
  const [issues,albums,recommendations] = await Promise.all([
    all("issues","id,slug,issue_number,title,subtitle,editorial,published_at,status,updated_at"),
    all("albums","id,title,artist,release_year,release_date,tags,cover_url,cover_fallback_url,manual_cover_url,musicbrainz_release_group_id,external_urls,updated_at"),
    all("recommendations","id,issue_id,album_id,recommendation_reason,review_summary,source_refs,recommendation_type,display_order,updated_at"),
  ]);
  return { issues:(issues as EditorialIssue[]).filter(i=>["draft","published"].includes(i.status)).sort((a,b)=>b.issue_number-a.issue_number), albums,recommendations } as EditorialWorkspace;
}
export async function previewEditorial(userId:string, mode:"create"|"append", raw:string, issueId?:string):Promise<EditorialPreview> {
  const catalog = await getImportCatalog(userId);
  if (mode === "create") {
    const parsed = parseImportedIssue(raw,true);
    return { ...parsed,checks:checkDuplicates(parsed.albums,catalog.albums),fingerprint:catalog.fingerprint,target:null,originalCount:0,minimum:1 };
  }
  if (!issueId) throw new Error("请先选择要追加的专栏期数。");
  const { data:target,error } = await createAdminClient().from("issues").select("id,slug,issue_number,title,subtitle,editorial,published_at,status,updated_at").eq("id",issueId).maybeSingle();
  if (error || !target || !["draft","published"].includes(target.status)) throw new Error("找不到可编辑的目标专栏。");
  const parsed = parseAlbumBatch(raw);
  const { count,error:countError } = await createAdminClient().from("recommendations").select("id",{count:"exact",head:true}).eq("issue_id",issueId);
  if (countError) throw new Error("无法核对目标专栏的专辑数量。");
  return { ...parsed,schema_version:"friday-records-albums-v1",issue:{issue_number:target.issue_number,publish_date:target.published_at.slice(0,10),title:target.title},checks:checkDuplicates(parsed.albums,catalog.albums),fingerprint:catalog.fingerprint,target:target as EditorialIssue,originalCount:count??0,minimum:1 };
}
export async function saveEditorial(userId:string, mode:"create"|"append", raw:string, issueId:string|undefined, decisions:ImportDecision[], fingerprint:string, issueVersion?:string) {
  const preview = await previewEditorial(userId,mode,raw,issueId);
  if (fingerprint !== preview.fingerprint || (mode === "append" && preview.target?.updated_at !== issueVersion)) throw new Error("资料已变化，请重新预览并确认。");
  const selected = resolveImport(preview.albums,preview.checks,decisions,{ minimum:1,targetSlug:preview.target?.slug });
  const parsedIssue = mode === "create" ? parseImportedIssue(raw,true).issue : null;
  const payload = { mode,schema_version:preview.schema_version,catalog_fingerprint:fingerprint,issue_id:issueId,issue_version:issueVersion,
    issue:parsedIssue ? { ...parsedIssue,status:"draft",slug:`issue-${parsedIssue.publish_date}-${String(parsedIssue.issue_number).padStart(3,"0")}` } : null,
    albums:selected.map(({index,albumId})=>({...preview.albums[index],original_index:index,existing_album_id:albumId,canonical_key:canonicalAlbumKey(preview.albums[index].artist,preview.albums[index].title,preview.albums[index].release_year)})),
  };
  const { data,error } = await createAdminClient().rpc("save_editorial_batch",{p_user_id:userId,p_payload:payload});
  if (error) throw new Error(editorialError(error.message));
  return data as {issue_id:string; albums:Array<{ index:number; album_id:string; created:boolean }>};
}
export function editorialError(message:string) {
  if (/IMPORT_CATALOG_CHANGED|EDITORIAL_CHANGED/.test(message)) return "资料已变化，请重新加载并预览；本次未保存。";
  if (/ALBUM_ALREADY_IN_ISSUE/.test(message)) return "该专辑已在目标专栏中，请编辑原条目，不要重复追加。";
  if (/issues_issue_number_key|issues_slug_key/.test(message)) return "该期号已存在，请选择已有期数追加，或修改新期号。";
  return `保存失败：${message}`;
}
export async function editEditorial(kind:"issue"|"recommendation"|"album",id:string,version:string,value:unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("编辑内容无效。");
  const input = value as Record<string,unknown>;
  let validated:Record<string,unknown>;
  if (kind === "issue") {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    const date = typeof input.publish_date === "string" ? input.publish_date : "";
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date || !["draft","published"].includes(String(input.status))) throw new Error("请填写标题、有效日期和发布状态。");
    if ([input.subtitle,input.intro].some(v=>v!=null && typeof v!=="string")) throw new Error("专栏文字必须是文本。");
    validated = {title,publish_date:date,status:input.status,subtitle:input.subtitle??null,intro:input.intro??null};
  } else {
    const batch = parseAlbumBatch(JSON.stringify({schema_version:"friday-records-albums-v1",albums:[input]}));
    if (batch.warnings.length) throw new Error(batch.warnings.join(" "));
    const parsed = batch.albums[0];
    validated = {...parsed};
    if (kind === "album") {
      const catalog = await getImportCatalog(null);
      if (checkDuplicates([parsed],catalog.albums.filter(a=>a.id!==id))[0].matches.some(m=>m.kind==="exact")) throw new Error("修改后会与另一张已有唱片重复，请核对名称或平台链接；不会自动合并。 ");
      validated.catalog_fingerprint = catalog.fingerprint;
      validated.canonical_key = canonicalAlbumKey(parsed.artist,parsed.title,parsed.release_year);
    }
  }
  const { error } = await createAdminClient().rpc("edit_editorial_record",{p_kind:kind,p_id:id,p_version:version,p_value:validated});
  if (error) throw new Error(editorialError(error.message));
}
