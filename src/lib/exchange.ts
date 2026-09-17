import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const schemaVersion = "friday-records-v1";
const recommendationTypes = ["taste_match", "exploration"] as const;
const listeningLabels: Record<string, string> = { want_to_listen:"想听", listened:"已听", not_interested:"不感兴趣" };

type JsonObject = Record<string, unknown>;
type ReviewSource = { name:string; score?:string | number | null; url:string };
type ImportedAlbum = {
  title:string; artist:string; release_date:string; release_year:number; cover_url?:string | null;
  recommendation_type:(typeof recommendationTypes)[number]; tags:string[]; recommendation_reason:string;
  review_summary:string; review_sources:ReviewSource[]; links:Record<string, string | null>;
};
export type ImportedIssue = {
  schema_version:typeof schemaVersion;
  issue:{ issue_number:number; publish_date:string; title:string; subtitle?:string | null; intro?:string | null };
  albums:ImportedAlbum[];
};
export type ExportMode = "issue" | "changes";
export type ExportPreview = { mode:ExportMode; issueId:string | null; content:string; items:Array<{ id:string; updatedAt:string }>; count:number };

function asObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}必须是 JSON 对象。`);
  return value as JsonObject;
}
function text(value: unknown, label:string, required = true) {
  if (value === undefined || value === null || value === "") { if (required) throw new Error(`${label}不能为空。`); return ""; }
  if (typeof value !== "string") throw new Error(`${label}必须是文本。`);
  return value.trim();
}
function optionalUrl(value: unknown, label:string) {
  if (value === undefined || value === null || value === "") return null;
  const url = text(value, label);
  try { const parsed = new URL(url); if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error(); } catch { throw new Error(`${label}必须是有效的 http(s) 链接。`); }
  return url;
}
function isoDate(value:string, label:string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new Error(`${label}必须是 YYYY-MM-DD 格式的有效日期。`);
  return value;
}
function canonicalKey(artist:string, title:string, year:number) {
  return `${artist} ${title}`.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, "-") + `-${year}`;
}

/** Parse only. This function never writes to Supabase. */
export function parseImportedIssue(raw:string): ImportedIssue {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  if (!cleaned) throw new Error("请先粘贴 ChatGPT 输出的 JSON。");
  let value:unknown;
  try { value = JSON.parse(cleaned); } catch { throw new Error("无法解析 JSON。请确认从第一个 { 到最后一个 } 的内容完整，且没有额外说明文字。"); }
  const root = asObject(value, "导入内容");
  if (root.schema_version !== schemaVersion) throw new Error(`只支持 schema_version 为 ${schemaVersion} 的导入文件。`);
  const issueRaw = asObject(root.issue, "issue");
  const issueNumber = Number(issueRaw.issue_number);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) throw new Error("issue.issue_number 必须是正整数。");
  const publishDate = isoDate(text(issueRaw.publish_date, "issue.publish_date"), "issue.publish_date");
  const issue = {
    issue_number:issueNumber,
    publish_date:publishDate,
    title:text(issueRaw.title, "issue.title"),
    subtitle:text(issueRaw.subtitle, "issue.subtitle", false) || null,
    intro:text(issueRaw.intro, "issue.intro", false) || null,
  };
  if (!Array.isArray(root.albums) || root.albums.length < 5 || root.albums.length > 8) throw new Error("每期必须包含 5 到 8 张专辑。");
  const albums = root.albums.map((item, index) => {
    const prefix = `第 ${index + 1} 张专辑`;
    const row = asObject(item, prefix);
    const title = text(row.title, `${prefix}.title`);
    const artist = text(row.artist, `${prefix}.artist`);
    const releaseDate = isoDate(text(row.release_date, `${prefix}.release_date`), `${prefix}.release_date`);
    const releaseYear = Number(row.release_year);
    if (!Number.isInteger(releaseYear) || releaseYear < 1900 || releaseYear > 2100) throw new Error(`${prefix}.release_year 必须是合理的四位年份。`);
    if (Number(releaseDate.slice(0, 4)) !== releaseYear) throw new Error(`${prefix}的 release_year 必须与 release_date 对应。`);
    if (!recommendationTypes.includes(row.recommendation_type as (typeof recommendationTypes)[number])) throw new Error(`${prefix}.recommendation_type 必须是 taste_match 或 exploration。`);
    if (!Array.isArray(row.tags) || row.tags.length === 0 || row.tags.some(tag => typeof tag !== "string" || !tag.trim())) throw new Error(`${prefix}.tags 必须是至少一个非空标签组成的数组。`);
    if (row.tags.length > 10) throw new Error(`${prefix}.tags 最多 10 个。`);
    const sourcesRaw = row.review_sources === undefined ? [] : row.review_sources;
    if (!Array.isArray(sourcesRaw)) throw new Error(`${prefix}.review_sources 必须是数组。`);
    if (sourcesRaw.length === 0) throw new Error(`${prefix}至少需要一条能支撑媒体摘要的乐评来源。`);
    const reviewSources = sourcesRaw.map((source, sourceIndex) => {
      const current = asObject(source, `${prefix}.review_sources[${sourceIndex}]`);
      const score = current.score;
      if (score !== undefined && score !== null && typeof score !== "string" && typeof score !== "number") throw new Error(`${prefix}的来源评分必须是文本或数字。`);
      const url = optionalUrl(current.url, `${prefix}的来源链接`);
      if (!url) throw new Error(`${prefix}的每条乐评来源都需要 URL。`);
      return { name:text(current.name, `${prefix}的来源名称`), ...(score === undefined || score === null || score === "" ? {} : { score:score as string | number }), url };
    });
    const linksRaw = row.links === undefined ? {} : asObject(row.links, `${prefix}.links`);
    const links:Record<string, string | null> = {};
    for (const key of ["spotify", "apple_music", "bandcamp", "musicbrainz"]) links[key] = optionalUrl(linksRaw[key], `${prefix}.links.${key}`);
    return {
      title, artist, release_date:releaseDate, release_year:releaseYear, cover_url:optionalUrl(row.cover_url, `${prefix}.cover_url`),
      recommendation_type:row.recommendation_type as ImportedAlbum["recommendation_type"], tags:(row.tags as unknown[]).map(tag => (tag as string).trim()),
      recommendation_reason:text(row.recommendation_reason, `${prefix}.recommendation_reason`), review_summary:text(row.review_summary, `${prefix}.review_summary`), review_sources:reviewSources, links,
    };
  });
  return { schema_version:schemaVersion, issue, albums };
}

export async function importIssue(userId:string, payload:ImportedIssue) {
  const slug = `issue-${payload.issue.publish_date}-${String(payload.issue.issue_number).padStart(3, "0")}`;
  const rpcPayload = {
    schema_version:payload.schema_version,
    issue:{ ...payload.issue, slug },
    albums:payload.albums.map(album => ({ ...album, canonical_key:canonicalKey(album.artist, album.title, album.release_year) })),
  };
  const { data, error } = await createAdminClient().rpc("import_friday_issue", { p_user_id:userId, p_payload:rpcPayload });
  if (error) {
    if (error.message.includes("already exists")) throw new Error("这一期编号已经导入过，不能重复导入。");
    throw new Error(`导入失败：${error.message}`);
  }
  return data as string;
}

type FeedbackRow = { id:string; album_id:string; listening_status:string | null; rating:number | string | null; rating_status:string; review:string | null; updated_at:string; last_exported_at:string | null; albums:{ title:string; artist:string; release_year:number } | null };
type IssueRef = { id:string; issue_number:number; title:string; published_at:string };

function formatRating(row:FeedbackRow) {
  if (row.rating_status === "no_rating") return "不评分";
  if (row.rating_status === "rated" && row.rating !== null) return `${Number(row.rating).toFixed(1)} / 10`;
  return "未评分";
}
function isChanged(row:FeedbackRow) { return !row.last_exported_at || new Date(row.updated_at).getTime() > new Date(row.last_exported_at).getTime(); }
function feedbackMarkdown(rows:FeedbackRow[], issueByAlbum:Map<string, IssueRef>, heading:string) {
  const records = rows.map(row => {
    const album = row.albums ?? { title:"未知专辑", artist:"未知艺人", release_year:0 };
    const issue = issueByAlbum.get(row.album_id);
    return `### ${album.title} — ${album.artist}${album.release_year ? ` (${album.release_year})` : ""}\n- 推荐来源：${issue ? `#${String(issue.issue_number).padStart(3, "0")}《${issue.title}》` : "已导入唱片库"}\n- 听歌状态：${row.listening_status ? listeningLabels[row.listening_status] ?? row.listening_status : "未标记"}\n- 评分：${formatRating(row)}\n- 我的短评：${row.review?.trim() || "（未写）"}\n- 最后更新：${new Date(row.updated_at).toLocaleString("zh-CN", { hour12:false })}`;
  }).join("\n\n");
  return `# 周五唱片室 · 反馈回传\n\n${heading}\n\n## 我的评分尺度（供 ChatGPT 在内部理解，不要按大众打分习惯误读）\n\n- 4.5 以下：明确负反馈\n- 5.0–5.5：中性偏弱，但有一定认可\n- 6.0–6.5：正面反馈，是值得听的好专辑\n- 7.0–7.5：强正面反馈，很喜欢、有重听价值\n- 8.0–8.5：极强个人审美命中\n- 9.0–10.0：极少见的顶级偏好信号\n\n## 评分与状态语义\n\n- “不评分”是主动不进入数值体系，不是 0 分、低分或负反馈；若有短评，仍可从短评提取信号。\n- “未评分”表示尚未决定，同样不是负面信号。\n- “想听”表示待探索；“已听”表示完成聆听；“不感兴趣”需与评分和短评一起理解。\n\n## 本次反馈\n\n${records || "本次范围内还没有已保存的反馈。"}\n\n## 请据此更新理解\n\n请结合这些原始反馈、我的评分尺度和文字短评，更新对我长期偏好与近期兴趣变化的理解；不要把“不评分”或“未评分”视作负向评价。`;
}

async function issueMapForAlbums(albumIds:string[]) {
  const result = new Map<string, IssueRef>();
  if (!albumIds.length) return result;
  const { data, error } = await createAdminClient().from("recommendations").select("album_id, issues(id, issue_number, title, published_at)").in("album_id", albumIds);
  if (error) throw new Error(`无法读取推荐来源：${error.message}`);
  for (const row of data ?? []) {
    const nested = Array.isArray(row.issues) ? row.issues[0] : row.issues;
    const issue = nested as IssueRef | null;
    if (!issue || (result.get(row.album_id) && new Date(result.get(row.album_id)!.published_at) >= new Date(issue.published_at))) continue;
    result.set(row.album_id, issue);
  }
  return result;
}

export async function getExportPreview(userId:string, mode:ExportMode, issueId?:string | null): Promise<ExportPreview> {
  const supabase = createAdminClient();
  let query = supabase.from("feedback").select("id, album_id, listening_status, rating, rating_status, review, updated_at, last_exported_at, albums(title, artist, release_year)").eq("user_id", userId).order("updated_at", { ascending:false });
  let issue:IssueRef | null = null;
  if (mode === "issue") {
    if (!issueId) throw new Error("请选择要导出的期数。");
    const { data:issueData, error:issueError } = await supabase.from("issues").select("id, issue_number, title, published_at").eq("id", issueId).maybeSingle();
    if (issueError || !issueData) throw new Error("找不到所选专栏。");
    issue = issueData as IssueRef;
    const { data:recommendations, error:recommendationError } = await supabase.from("recommendations").select("album_id").eq("issue_id", issueId);
    if (recommendationError) throw new Error(`无法读取本期专辑：${recommendationError.message}`);
    const albumIds = (recommendations ?? []).map(row => row.album_id);
    if (!albumIds.length) return { mode, issueId, content:feedbackMarkdown([], new Map(), `导出范围：#${String(issue.issue_number).padStart(3, "0")}《${issue.title}》`), items:[], count:0 };
    query = query.in("album_id", albumIds);
  }
  const { data, error } = await query;
  if (error) throw new Error(`无法读取反馈：${error.message}`);
  const rows = (data ?? []) as unknown as FeedbackRow[];
  const selected = mode === "changes" ? rows.filter(isChanged) : rows;
  const issueMap = await issueMapForAlbums(selected.map(row => row.album_id));
  if (issue) selected.forEach(row => issueMap.set(row.album_id, issue!));
  const heading = mode === "changes" ? "导出范围：自上次成功导出后发生变化的反馈" : `导出范围：#${String(issue!.issue_number).padStart(3, "0")}《${issue!.title}》`;
  return { mode, issueId:issueId ?? null, content:feedbackMarkdown(selected, issueMap, heading), items:selected.map(row => ({ id:row.id, updatedAt:row.updated_at })), count:selected.length };
}

export async function confirmExport(userId:string, preview:ExportPreview) {
  const items = preview.items.map(item => ({ id:item.id, updated_at:item.updatedAt }));
  const { data, error } = await createAdminClient().rpc("confirm_feedback_export", { p_user_id:userId, p_export_type:preview.mode, p_issue_id:preview.issueId, p_content:preview.content, p_items:items });
  if (error) throw new Error(`无法标记导出：${error.message}`);
  return data as string;
}

export async function getLatestExport(userId:string) {
  const { data, error } = await createAdminClient().from("export_runs").select("content_snapshot").eq("user_id", userId).order("confirmed_at", { ascending:false }).limit(1).maybeSingle();
  if (error) throw new Error(`无法读取最近导出：${error.message}`);
  return data?.content_snapshot ?? null;
}
