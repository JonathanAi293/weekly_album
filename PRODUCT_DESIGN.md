# 周五唱片室 · 产品设计文档

> 定位：一个人的长期音乐推荐专栏。它每周只送来 5–8 张新专辑，重点不是「猜你喜欢」的即时点击，而是通过真实评分、短评和聆听状态，逐步形成可解释、可校准的偏好画像。

## 1. 产品总览

### 核心原则

- **私人且克制**：固定唯一用户，不做注册、社交、分享、关系链和多租户权限。
- **专栏而非信息流**：每周五生成一期可回看的编辑式页面；每张专辑有明确的选择理由和来源。
- **长期学习**：原始反馈长期保存，模型读取的是周期性压缩的偏好画像 + 少量增量反馈，不反复吞入完整历史。
- **命中与探索并存**：每期建议 3–5 张「口味命中」、2–3 张「探索推荐」。默认排除以说唱/嘻哈为主要风格的作品。
- **可信与可追溯**：媒体评语必须绑定来源 URL；模型仅能基于抓取到的短摘录改写，不能编造评分、发布日期或媒体观点。

### 第一版范围与取舍

第一版应完成阅读、反馈、存储、定时生成和偏好更新闭环。推送通知、离线缓存进阶策略、专辑搜索/补录、可视化成本看板不应阻挡首发：前两项在 iOS PWA 上存在平台限制或额外复杂度，后两项可由 Supabase 表和 Vercel 日志暂时承担。

### 产品结构

| 页面 | 目的 | 主要模块 |
| --- | --- | --- |
| 首页 | 当周入口 | 品牌导语、本周期号、四张预览卡、全文入口 |
| 单期专栏 | 完整阅读和反馈 | 专栏导言、5–8 张推荐卡、来源链接、评分/状态/短评 |
| 往期专栏 | 回看和再听 | 按日期倒序的期号、标题、专辑数、打开入口 |
| 想听 | 待播放唱片架 | 当前 `want_to_listen` 状态的专辑，按状态更新时间倒序 |
| 年度 | 私人年度新专辑榜 | 按发行年份、已听状态、评分层级整理的唱片年鉴 |
| 偏好画像 | 让推荐可解释 | 最新画像、长期偏好、近期变化、暂时避开 |
| （运维）日志 | 仅开发期排障 | 生成状态、候选数、模型、错误摘要；不必进入用户主导航 |

## 2. 信息架构

```text
/
├── 本周推荐预览
├── /issues/[issue-date]        单期专栏（推荐列表 + 反馈）
├── /archive                    往期专栏
├── /want                       想听唱片架
├── /annual                     私人年度唱片年鉴
├── /preferences                偏好画像
├── /api/feedback               保存评分 / 状态 / 短评
├── /api/cron/generate-weekly   Vercel Cron 生成当周专栏
└── /api/cron/refresh-profile   （Phase 4）增量更新偏好画像
```

不建议第一版做「专辑详情独立页」：推荐卡已包含足够的阅读与反馈上下文。桌面端如果需要更密集浏览，可在 Phase 5 把卡片详情改为右侧抽屉，但移动端仍保持整页自然滚动。

## 3. 数据库设计

实现 SQL 位于 [`20260912_000001_initial_data_layer.sql`](supabase/migrations/20260912_000001_initial_data_layer.sql)。实体关系如下：

```text
issues 1 ── * recommendations * ── 1 albums 1 ── * source_refs
                                           └── 1 feedback
preference_profiles（版本化快照）
generation_logs（关联一次 issue 或 profile 任务）
```

| 表 | 用途 | 关键字段 |
| --- | --- | --- |
| `issues` | 每周专栏 | `issue_date`、`issue_number`、`title`、`intro`、`status` |
| `albums` | 标准化专辑资料 | `canonical_key`、艺人、发行日期、主风格、标签、封面、外部 ID |
| `recommendations` | 某期内的编辑信息 | 期号/专辑外键、顺序、`kind`、推荐理由、媒体摘要、模型元数据 |
| `feedback` | 真实用户输入 | 专辑外键、1.0–10.0 分（0.5 步进）、状态、短评、更新时间；单用户每专辑一行 upsert |
| `preference_profiles` | 画像快照 | JSON 画像、覆盖到的 feedback 时间、prompt/model 版本、当前标记 |
| `source_refs` | 可追溯的评价来源 | 来源名、URL、发布时间、分数、允许摘要的短摘录 |
| `generation_logs` | 可诊断性 | 任务类型、状态、输入/输出摘要、错误信息与耗时 |

`canonical_key`、`slug`、`(issue_id, album_id)` 与 `(issue_id, display_order)` 共同防止重复；候选查询需检查历史 `recommendations` 与 `feedback.listening_status='listened'`。已提供发行年份、反馈更新时间与排序索引。RLS 全开：目录数据仅对 authenticated 用户可读，feedback 与偏好画像按 `auth.uid()` 隔离；前端只用 publishable key，service role 仅为未来服务器任务预留。

### 想听与年度的派生查询

两页不各自保存列表，而是都从 `feedback` 派生：想听页筛选 `listening_status='want_to_listen'`，按 `status_updated_at desc` 排序；用户变更为已听、不感兴趣或清除状态后会自动消失。年度页的唯一归属规则是 `albums.release_year`（可由可靠的 `release_date` 写入时计算），绝不使用 `listened_at` 或评分时间。查询条件是 `release_year = :year AND feedback.listening_status = 'listened'`；`rating_status='rated'` 的作品先按评分降序分组、同分并列，其后依次是 `rating_status='no_rating'` 的「不评分」和 `rating_status='pending'` 的「未评分」。`status_updated_at` 与触发器保证编辑短评不会扰乱想听加入顺序。

## 4. 后端流程

### 每周五生成（推荐 UTC 00:10，即中国标准时间周五 08:10）

1. Cron 以 `CRON_SECRET` 调用生成路由，先创建/锁定本周 `issues` 草稿；存在已发布期则幂等退出。
2. 候选采集器从**允许访问的公开 RSS、官方/媒体页面或有授权 API**读取过去 7–21 天的新专辑和新重要评论。把原始 URL、日期、评分/摘录写入 `source_refs`，再 upsert `albums`。不要把任意网页整页抓取后交给模型。
3. 规则层剔除主风格为 rap/hip-hop、发行太旧、历史已推荐或已听、来源不足的候选；按新鲜度、媒体信号和画像相似度得到 20–40 个候选。
4. 取当前 `preference_profile`、最近 8–15 条新增 feedback 摘要、以及近期已推荐 ID；让模型从候选中挑 5–8 张，并明确命中/探索配额。
5. 对每张中选专辑生成简短标签、推荐理由、**严格基于提供摘录**的媒体评语；用 Zod/JSON Schema 验证，再写入 `recommendations` 和 `issues`。
6. 成功发布，记录 `generation_logs`；失败保留 draft 和错误，下一次运行可重试，不产生半成品公开页。

### 反馈与画像更新

`POST /api/feedback` 对同一 `(user_id, album_id)` upsert，保存评分、状态与短评，同时记录 `updated_at`。评分使用 `numeric(3,1)`，只接受 1.0–10.0 的 0.5 步进。`rating_status` 将「未评分」（`null/pending`）与主动选择的「不评分」（`null/no_rating`）区分开，正常数值评分为 `rating/rated`。完整约束和 RLS 已包含在初始 Supabase migration 中。画像生成尚未在本阶段接入。

### 私人评分解释（仅系统内部）

用户的标尺偏严格，原始分数永远不被改写。推荐和画像层将其映射为：`<5` 明确负反馈；`5–5.5` 中性偏弱；`6–6.5` 正面（好专辑，值得听）；`7–7.5` 强正面；`8–8.5` 极强个人审美命中；`9–10` 罕见的顶级信号。主动「不评分」与尚未评分都不参与平均分、命中率、排名或数值偏好推断，也不能被当作低分或负反馈；但其文字短评仍可提供定性信号。模型必须同时看短评、想听/已听/不感兴趣和可能的重听证据；若文字与分数表面冲突，先按这套严格尺度复核，不把 6 分误读为失败。实现集中在 `src/lib/recommendation-rules.ts`，且不在任何前端评分提示中显示。

### iPhone 安全区与返回体验

- 全站 `:root` 定义 `env(safe-area-inset-top/right/bottom/left)` 变量；`.page` 统一处理左右和底部空间，`.nav` 在安全区之后额外留 8–10px。因此所有页面的导航、返回按钮和顶端链接都避开灵动岛、刘海与状态栏；Safari 的 inset 为零时仍保留正常间距。
- 当前没有 fixed 或 sticky 工具栏。若以后添加底部固定操作条，必须使用 `padding-bottom: max(… , env(safe-area-inset-bottom))`，不能直接贴到 viewport 底部。
- Safari 浏览器保留原生左边缘返回手势；仅在 iPhone standalone PWA 中启用 24px 左侧起手、水平移动超过 88px 的轻量回退。垂直偏移超过 56px 立即取消，因而不劫持普通滚动。
- 路由追踪器只记录本 PWA 的 client-side 跳转；有站内历史时回退 `router.back()`，直接打开深链接时回到该页面的明确上级而不跳去外部网页。往期、偏好与单期页都有顶部返回按钮；首页是根页面，无需返回按钮。

## 5. AI 调用策略

### 模型分工

- **不调用模型**：日期/流派过滤、去重、候选排序、来源抓取、封面处理、数据库写入。
- **低成本模型**：来源短摘录的事实限定式压缩、标签标准化、反馈增量的预摘要。批量处理，缓存 `album_id + source_ref` 哈希。
- **较强模型**：每周 1 次候选编排，以及偏好画像刷新。它们需要在「命中/探索平衡、不可重复、解释性」之间做判断，值得使用更强模型。

### 成本与质量控制

- 每周仅一次主推荐调用；每张卡最多一次补充文案调用，优先用同一次结构化输出完成。
- 来源摘要、候选资料与画像都缓存并带内容哈希；无新增来源/反馈则跳过任务。
- 输入只给候选的结构化资料、当前画像、增量反馈、最近 12 周推荐 ID/关键词，限制 token；保留原始短评在数据库而非 prompt。
- 画像任务设置门槛：没有新评分/评论，或距离上次更新少于 24 小时，直接 `skipped`。
- 生成前后都执行规则校验：5–8 张、探索 2–3 张、无历史重复、无 rap/hip-hop 主风格、所有媒体概述有来源。失败时要求模型只修复不合格字段一次，仍失败则人工草稿。

### 结构化输出契约

使用 OpenAI Responses API 的 JSON Schema/Structured Outputs。输入提供 `candidates[]`、`profile`、`recent_feedback[]` 和 `recently_recommended_ids[]`；输出只允许：

```json
{
  "issue_title": "string",
  "intro": "string",
  "recommendations": [{
    "album_id": "uuid",
    "kind": "taste_match | exploration",
    "tags": ["最多 4 项"],
    "reason": "80–120 字，说明为何值得听",
    "media_summary": "≤70 字，仅基于 source_excerpt"
  }]
}
```

Prompt 中要求：不猜测缺失事实；不得把来源的评价改写成具体分数；用「口味命中」解释与画像的连接，用「探索推荐」说明陌生度与进入路径；探索不是随机，而是与至少一个已知偏好信号存在弱连接。用近期历史 ID 与相近 artist/tag 的软惩罚，降低连续数周重复。每个画像刷新和推荐 prompt 都附加私人严格评分规则，避免把 6–6.5 的正面反馈误判为失败。

## 6. MVP 开发路线

| 阶段 | 做什么 | 为什么现在做 | 可验收成果 |
| --- | --- | --- | --- |
| Phase 1 | 当前 Next 页面、示例数据、卡片交互、响应式视觉 | 先验证阅读和记录体验 | iPhone/桌面可浏览专栏，评分与状态即时响应 |
| Phase 2 | Supabase schema、服务端读取/写入、基础管理页 | 让反馈与往期持久化 | 新增短评刷新后仍在；专栏从表中读取 |
| Phase 3 | 候选采集适配器、来源保存、OpenAI 结构化生成、Cron | 形成每周专栏的核心自动化 | 周五自动产出可审阅 draft，并有来源与日志 |
| Phase 4 | 画像增量刷新、去重/探索配额、失败重试 | 使推荐长期更贴近而不僵化 | 新反馈影响后续推荐；画像可查看、可回溯 |
| Phase 5 | Service worker 离线壳、安装引导、可选 Web Push、视觉微调 | 优化日常使用，不干扰核心闭环 | 可加到主屏，弱网可打开已读内容 |

## 7. UI 组件建议

| 组件 | 作用 | 核心字段 |
| --- | --- | --- |
| `SiteNav` | 极简导航与品牌 | 当前路由 |
| `IssueHeader` | 期号、日期、标题、导语 | `number/date/title/intro` |
| `WeeklyColumnCard` | 首页专栏入口 | `issue title/count/date` |
| `AlbumRecommendationCard` | 首页/专栏的专辑叙事单元 | 封面、艺人、年、tags、kind、reason、media summary |
| `TagList` | 一致的风格标签 | `tags[]` |
| `ListeningStatusToggle` | 想听/已听/不感兴趣 | `albumId/status` |
| `RatingInput` | 1.0–10.0、0.5 步进的低摩擦记录 | `albumId/rating` |
| `WantShelf` | 想听专辑的派生列表 | `feedback.status/status_updated_at` |
| `AnnualYearbook` | 按发行年和评分档位展示已听专辑 | `releaseYear/status/rating` |
| `CommentBox` | 面向自己的短评 | `albumId/comment` |
| `PreferenceSummaryCard` | 最新画像摘要 | `profile/version/updatedAt` |
| `EmptyState` | 尚无专栏或反馈时的引导 | `title/body/action` |

当前原型把后三个反馈组件收进 `FeedbackPanel`，等 Phase 2 接入真实存储后再按复用需要拆开。

## 8. 界面文案

- 首页标题：**给耳朵的每周来信**
- 副标题：**不是榜单，是慢慢学会你的专栏。**
- 专栏标题格式：**#018｜在夜色还没散去时听**
- 专栏到达：**本周已送达：六张唱片，四次回声，两次试探。**
- 推荐理由区：**为什么值得听**
- 来源区：**媒体的另一种说法**
- 评分区：**这一张，留给你几分？**
- 短评占位：**留一句给未来自己的短评：哪一刻让你想重听？**
- 空状态：**唱片室还没开张。下一个周五，会有第一封来信。**
- 画像提示：**你的感受正在慢慢变成下一次选择的方向。**

## 9. 视觉设计建议

关键词是：**纸张、唱片、留白、编辑页、低声的温度**。底色用暖灰纸张 `#F4F1EA`，正文深墨绿 `#1E2622`，主色松针绿 `#263A32`，强调色陶土 `#AA6147`，探索标签用柔和杏色 `#E7B06F`。避免高对比渐变、霓虹与数据仪表盘语汇。

- **首页**：大字号衬线标题、期号印章与两列卡片，像专栏首页。
- **单期页**：单列长阅读，卡片之间用细线分隔；封面是视觉锚点，反馈区低调收于每张卡底部。
- **偏好页**：更像编辑笔记，用一张大摘要卡和三块信号卡解释系统，不绘制分数图表。
- **想听页**：像一张窄而长的待播清单，保留推荐期数作为书签，不把它设计成收藏商城。
- **年度页**：以大字号年份与评分档位为阅读节奏；同分卡片横向滑动且轻微 scroll-snap，卡片只呈现封面、作者、分数和少量标签，不出现奖牌、名次或数据仪表盘。所有数值档位之后依次是「不评分」和「未评分」，二者不参与排序。
- **卡片**：方形封面、1px 灰绿边框、无大圆角；只在 hover 有轻微位移和纸张阴影，手机上不依赖 hover。
- **字体**：标题使用 Georgia / 宋体回退，正文使用系统无衬线；不为第一版引入额外字体请求，减少 PWA 首屏负担。
- **布局**：移动端 16px 边距、单列，桌面端内容最大 1180px；触控按钮至少 36px 高，保证 iPhone 手感。

## 10. 部署与运行

1. 新建 Supabase 项目，执行 `supabase/migrations/20260912_000001_initial_data_layer.sql`，复制 `.env.example` 为 `.env.local` 并填入 URL 与 Publishable key；完整步骤见 [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md)。
2. 在 Vercel 导入仓库，设置同名环境变量。Cron 采用 UTC，`vercel.json` 当前为周五 UTC 00:10（中国标准时间 08:10）。
3. Phase 2 起，加入 `@supabase/supabase-js`、`openai` 和 `zod`；所有密钥与 OpenAI 调用只能在 Route Handler / server 侧。
4. 采集层应为每个媒体实现独立 adapter，优先 RSS/官方 API/页面允许的元数据。若没有可稳定、合规的获取方式，不把该站列为自动来源，而是提供手工候选录入。

当前前端专辑资料是**演示数据**，仅用于验证产品与视觉，不应作为实际发行或媒体评价事实发布。真实推荐必须由候选采集、来源记录和结构化验证流程生成。
