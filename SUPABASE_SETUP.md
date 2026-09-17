# Supabase 数据层与手动交换模式

## 执行顺序

在 Supabase SQL Editor（或 Supabase CLI）依次执行：

1. [`20260912_000001_initial_data_layer.sql`](supabase/migrations/20260912_000001_initial_data_layer.sql)
2. 如果以前执行过旧版 AI 迁移：[`20260913_000002_ai_generation.sql`](supabase/migrations/20260913_000002_ai_generation.sql)
3. [`20260917_000003_manual_exchange.sql`](supabase/migrations/20260917_000003_manual_exchange.sql)

第三个迁移保留 `albums`、`issues`、`recommendations`、`feedback` 和 `preference_profiles`；新增手动导入/导出的记录与游标。它会删除旧版 AI 生成日志与 RPC，因为新架构不再使用它们。

## 环境变量

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
SUPABASE_SECRET_KEY=<server-only Supabase secret key>
ADMIN_EMAIL=<你的 Supabase Auth 登录邮箱>
```

`SUPABASE_SECRET_KEY` 只在服务器的 `/api/admin/import`、`/api/admin/export` 中使用，绝不能使用 `NEXT_PUBLIC_` 前缀。项目不需要 `OPENAI_API_KEY`、百炼 Key 或任何 `AI_*` 环境变量。

## 手动流程

1. 在 ChatGPT 中按 [`MANUAL_EXCHANGE.md`](MANUAL_EXCHANGE.md) 生成 `friday-records-v1` JSON。
2. 登录后打开 `/admin`，粘贴 JSON，点击「检查并预览」。此时不会写数据库。
3. 核对后点击「确认导入本期」。数据库函数会在单一事务中创建专栏、去重专辑、推荐卡和来源；任一步失败都会回滚。
4. 正常使用专栏、想听、年度和评分功能。
5. 在 `/admin` 导出「自上次导出后的变化」或某一期反馈。预览不推进游标；只有复制成功或手动确认复制后才标记已导出。

## 基础验收

1. 用 [`examples/friday-records-v1.sample.json`](examples/friday-records-v1.sample.json) 测试预览，导入前把样例期号改为未使用编号。
2. 重复确认同一期编号应被阻止。
3. “想听”与“年度”仍分别由 `feedback.listening_status` 和 `albums.release_year` 驱动。
4. 仅生成导出预览后再次预览，应仍包含同一批记录；标记已导出后，未修改记录应从下一次变化导出消失。
5. “不评分”保持 `rating = null`、`rating_status = no_rating`，不进入数值排序或平均值。
