# ChatGPT 手动交换格式

网页不在内部调用任何 AI。ChatGPT 负责研究、推荐与理解反馈；网页只负责导入、浏览、反馈和导出。

## 生成专栏时给 ChatGPT 的提示

> 请生成一份适用于“周五唱片室”的 `friday-records-v2` JSON。只输出 JSON（可包在 json 代码围栏中），不要输出解释文字。每期 5–8 张最近发行或近期获得重要评价的专辑，避免与已推荐/已听作品重复；兼顾 `taste_match` 与 `exploration`。不要把说唱/嘻哈作为默认硬排除，应依照我的实际偏好与文字反馈判断。每张专辑必须核对艺人、专辑名和发行日期；若写入 `review_summary`，至少一条 `review_sources` URL 必须确实讨论这位艺人与这张专辑。不要臆造 URL、评分、封面或发行日期。

## JSON Schema（阅读版）

```json
{
  "schema_version": "friday-records-v2",
  "issue": {
    "issue_number": 19,
    "publish_date": "2026-09-18",
    "title": "本周标题",
    "subtitle": "可选副标题",
    "intro": "本期导语"
  },
  "albums": [
    {
      "title": "Album title",
      "artist": "Artist",
      "release_date": "2026-09-11",
      "release_year": 2026,
      "cover": {
        "musicbrainz_release_group_id": "真实确认过的 Release Group UUID 或 null",
        "fallback_url": "https://可靠的封面图片或 null"
      },
      "recommendation_type": "taste_match",
      "tags": ["dream pop", "art rock"],
      "recommendation_reason": "简短中文推荐理由",
      "review_summary": "有来源支撑的简短中文乐评摘要",
      "review_sources": [{ "name": "Pitchfork", "score": 8.2, "url": "https://..." }],
      "links": { "spotify": "https://...", "apple_music": null, "bandcamp": null, "musicbrainz": "https://musicbrainz.org/release/..." }
    }
  ]
}
```

必填：schema 版本、期号、发布日期、标题、专辑标题/艺人/发行日期/发行年份/推荐类型/tags/推荐理由/乐评摘要。`subtitle`、`intro`、封面和平台链接可为空。每条乐评来源需有名称与有效 `http(s)` URL；评分可选。

## 封面字段规范（必须遵守）

每张专辑都必须带上 `cover` 对象：

```json
"cover": {
  "musicbrainz_release_group_id": "真实确认过的 UUID 或 null",
  "fallback_url": "可靠 HTTPS 封面图片 URL 或 null"
}
```

- `musicbrainz_release_group_id` 必须是 **MusicBrainz Release Group MBID**，不是 Artist、Release、Recording 或 Track MBID。
- 必须通过 MusicBrainz 页面或可靠检索确认；找不到就填 `null`。
- 禁止猜测、编造或按 UUID 格式补全 MBID。宁可没有封面，也不能展示错误唱片。
- `fallback_url` 只能是可直接加载的可靠 HTTPS 图片 URL；不确定则填 `null`。
- 封面缺失不影响推荐本身。网站会按「手动封面 → Cover Art Archive → fallback_url → 占位封面」处理。

旧版 `friday-records-v1` 与其中的 `cover_url` 仍可导入，仅作为旧数据兼容来源；以后应优先生成 v2。

导入优先按 MusicBrainz Release Group MBID、Spotify、Apple Music、Bandcamp 链接去重，均无匹配时才使用标准化「艺人 + 标题 + 发行年」键。

## 反馈回传

编辑台导出的 Markdown 已写入个人评分尺度：6.0–6.5 是正面，7.0 以上强正面，8.0 以上极强命中；“不评分”和“未评分”都不是负反馈。整段粘贴回 ChatGPT，并要求它仅据此更新对你长期偏好、近期变化和下一期选盘方向的理解。
