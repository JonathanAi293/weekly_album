# ChatGPT 手动交换格式

网页不在内部调用任何 AI。ChatGPT 负责研究、推荐与理解反馈；网页只负责导入、浏览、反馈和导出。

## 生成专栏时给 ChatGPT 的提示

> 请生成一份适用于“周五唱片室”的 `friday-records-v2` JSON。只输出 JSON（可包在 json 代码围栏中），不要输出解释文字。每期支持 2–14 张最近发行或近期获得重要评价的专辑，按当期值得推荐的作品数量灵活选择，避免与已推荐/已听作品重复；兼顾 `taste_match` 与 `exploration`。不要把说唱/嘻哈作为默认硬排除，应依照我的实际偏好与文字反馈判断。每张专辑必须核对艺人、专辑名和发行日期；若写入 `review_summary`，至少一条 `review_sources` URL 必须确实讨论这位艺人与这张专辑。不要臆造 URL、评分、封面或发行日期。

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

导入预览会检查本次内部与全部历史专栏（含草稿）。可靠平台专辑 ID 或标准化「艺人 + 标题」一致时明确匹配，不使用年份排除重复；链接会提取专辑 ID，忽略追踪参数与 Apple Music 地区差异。豪华版、重制版及部分标题变体列为疑似重复，不自动合并。

历史重复或疑似重复项必须先选择“跳过”或明确确认收录；同一期同一张专辑只能保留一次。JSON 整期导入跳过后仍需满足 2–14 张；表单及追加模式保留 1–14 张即可。个人反馈仅作提醒，不单独阻止首次推荐。多个历史记录匹配时需选择要复用的记录，不自动合并旧数据。

确认重荐会复用原专辑 ID，仅新增本期推荐关系，原有评分、短评、封面和发行年份不被覆盖。疑似版本可明确选择作为不同专辑新建，也可选择复用。保存前后端再次执行匹配，数据库写入事务同时验证预览资料指纹；期间若唱片库或推荐关系变化，则要求重新预览。原 `friday-records-v1/v2` JSON 协议不变，决策只存在于编辑台请求内。

部署顺序：先应用 `supabase/migrations/20261017044224_import_duplicate_review.sql`，再部署网站。迁移只增加服务端专用目录读取和查重导入函数，不删除或修改已有唱片、反馈；旧导入函数为旧站兼容保留，新站调用 `import_friday_issue_reviewed`。本次迁移已应用至当前关联 Supabase 项目，不需要重复手工执行。

规则回归测试：`node --test scripts/test-import-dedupe.cjs`。

## 图形化录入与 JSON 追加

编辑台默认仍为「JSON 导入 → 导入完整一期」。`friday-records-v1/v2` 格式与整期发布行为不变。

### 向已有一期追加

选择「向已有一期追加」，在编辑台选定期数后粘贴以下格式（1–14 张／次）：

```json
{
  "schema_version": "friday-records-albums-v1",
  "albums": [
    {
      "title": "Album Name",
      "artist": "Artist Name",
      "release_year": 2026,
      "recommendation_type": "taste_match",
      "tags": ["Dream Pop"]
    }
  ]
}
```

追加格式不允许包含 `issue`；期数只由选择器决定，防止投错期。字段与 v2 的专辑部分兼容，但 `release_date`、封面、试听链接、推荐理由和媒体资料可选。只知道年份时不要补造日期，省略 `release_date` 或填 null。填写 `review_summary` 时必须同时提供至少一条有效 `review_sources`。推荐类别仍为 `taste_match` / `exploration`。

追加只新增推荐关系，不覆盖专栏信息或原条目；保留目标专栏的草稿／发布状态。已发布专栏保存后立即更新，草稿不会自动发布。同期已有的专辑不能重复追加，请使用「编辑栏目」修改原条目。剩余条目接在当前最大序号后方；每期不设产品数量上限，每次最多新增 14 张。

### 表单录入

切换「表单录入」，可以加入已有专栏，也可以新建草稿。新建时填写期号、日期、标题，副标题与开篇文字可选；专辑必填名称、艺术家、发行年份、至少一个风格标签和推荐类别。可搜索并复用唱片库，原有共享资料锁定；要修改请进入「编辑栏目 → 共享唱片资料」。

推荐理由、媒体摘要、来源及封面可选。照片支持 JPG、PNG、WebP，最大 5MB；HEIC 请先转换。唱片事务成功后再复用原上传接口保存封面，失败会明确提示并提供重试，不需要重新导入。查重后复用的旧唱片保留原封面，不用本次文件覆盖。

### 编辑与发布

「编辑栏目」可以修改专栏标题、副标题、开篇文字、日期与发布状态；期号和 URL 不变。新建草稿需要在这里明确切换为「已发布」并确认保存。也可编辑本期推荐文字、媒体来源、推荐类别；共享唱片名称、年份、标签、试听链接和自动封面来源分开保存，修改前提示全站影响。手动封面使用独立操作，评分、状态、短评和评分历史不参与编辑请求。

保存使用版本检查：资料在编辑期间被其他操作改动时会拒绝覆盖，要求重新加载。切换入口、切换编辑对象、刷新／关闭或点击离开链接时，对尚未保存的输入进行提醒；不会在设备本地保存私人草稿。

迁移 `supabase/migrations/20261017052009_editorial_forms.sql` 已应用至当前关联项目。它新增服务端专用事务函数，并将推荐序号从 smallint 的 1–14 约束调整为正整数，保留同一期专辑与序号的唯一约束。无需再次手动执行；发布网站代码即可启用新入口。回滚集成测试见 `scripts/test-editorial-transaction.sql`，该脚本包含最终 rollback，不保留测试数据。

权限检查确认新事务仅允许服务端角色调用，未登录接口返回 401。Supabase 安全检查未报告本次新增函数的问题；仍有既有的 [旧触发器 search_path 提示](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)及[泄露密码保护未开启提示](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)，本次没有改动这些设置。部分仅服务端使用的记录表启用 RLS 而未配置客户端策略，会继续阻止客户端直接读写，参见 [RLS 提示说明](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)。

## 反馈回传

编辑台导出的 Markdown 已写入个人评分尺度：6.0–6.5 是正面，7.0 以上强正面，8.0 以上极强命中；“不评分”和“未评分”都不是负反馈。整段粘贴回 ChatGPT，并要求它仅据此更新对你长期偏好、近期变化和下一期选盘方向的理解。
