# Supabase 数据层接入说明

## 已完成的迁移

| 前端 MVP 原位置 | 现在的数据源 |
| --- | --- |
| `src/lib/data.ts`：专辑和三期专栏 mock | `albums`、`issues`、`recommendations` 查询 |
| `FeedbackProvider` 的 localStorage | `feedback`，经 `/api/feedback` 在当前 Auth 用户下 upsert |
| 想听的 localStorage 过滤 | 推荐专辑目录 + `feedback.listening_status = want_to_listen` |
| 年度的 mock `releaseYear` 分组 | `albums.release_year` + `feedback.listening_status = listened` |
| 偏好页面静态示例 | 当前用户的 active `preference_profiles`；无资料时显示空状态 |

`src/lib/data.ts` 和 `src/lib/library.ts` 已删除。界面模型在 `src/lib/models.ts`，服务端读取集中在 `src/lib/queries.ts`；因此没有组件自行创建数据库客户端，也没有重复收藏表。

## 执行 SQL

在一个新的 Supabase 项目的 SQL Editor 中执行：

1. [`20260912_000001_initial_data_layer.sql`](supabase/migrations/20260912_000001_initial_data_layer.sql)
2. 可选：[`seed.demo.sql`](supabase/seed.demo.sql)，导入原型中的演示专辑和三期专栏。它不会创建用户或 feedback，且仅适合本地/UI 验证。

完整 migration 包含 tables、enums、约束、索引、`updated_at`/状态时间 trigger、RLS 和 policies。`source_refs` 保存在 `recommendations.source_refs` JSONB，避免这一阶段过度拆表。

## 环境变量

复制 `.env.example` 为 `.env.local`，填入：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
```

`SUPABASE_SERVICE_ROLE_KEY` 保留给未来服务端生成任务；本阶段没有使用它，且绝不可添加 `NEXT_PUBLIC_` 前缀或传给浏览器。

## Supabase Dashboard 手动步骤

1. 创建 Supabase 项目并执行 migration。
2. 在 **Authentication → Providers → Email** 启用 Email / Magic Link。
3. 在 **Authentication → URL Configuration** 添加本地地址 `http://localhost:3000/auth/callback` 与生产地址 `https://你的域名/auth/callback` 到 Redirect URLs。
4. 在 Vercel 项目配置上述两项 `NEXT_PUBLIC_*` 环境变量后重新部署。
5. 通过 `/login` 输入自己的邮箱；首次登录会创建 Auth 用户。RLS 已限制 feedback 与 preference profiles 仅可被这个已登录用户读取或写入。

## 手动验收

1. 登录后，首页应从 `issues` 中显示最近一条 `status='published'` 专栏。
2. 在单期页标记「想听」，刷新/进入“想听”页仍可见；改为「已听」后自动退出想听并进入其 `release_year` 的年度页。
3. 给「已听」专辑 7.5，年度页应在 7.5 层；滑到“不评分”并保存，应移至最下方“不评分”，不出现 0 分。
4. 使用另一个 Supabase Auth 用户登录，确认其无法读取前一用户的 feedback 或 preference profile。
5. 检查浏览器开发者工具：只存在 Publishable/anon key，不存在 service-role key。

## 本阶段刻意未接入

- OpenAI API、偏好画像生成与推荐生成。
- Vercel Cron 与任何自动任务；此前的 Cron placeholder routes/config 已移除。
- 多用户社交、公开浏览、媒体采集与管理员后台。
