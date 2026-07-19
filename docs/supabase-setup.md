# Supabase 配置指南（Phase 1）

本文档说明如何创建 Supabase 项目、启用 Auth、执行数据库迁移。

## 1. 创建项目

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. **New Project** → 选择组织、填写名称（如 `auditlens`）、设置数据库密码
3. 等待项目 provisioning 完成

## 2. 启用 Email + Password 登录

1. **Authentication** → **Providers** → **Email**
2. 确认 **Enable Email provider** 已开启
3. MVP 可关闭 **Confirm email**（便于本地 Demo）；生产环境建议开启

## 3. 获取 API 密钥

**Project Settings** → **API**：

| 变量 | 来源 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key（**仅服务端**，勿暴露给浏览器） |

写入项目根目录 `.env.local`：

```bash
cp .env.example .env.local
# 填入上述三个 Supabase 变量
```

## 4. 执行数据库迁移

迁移文件：

1. [`supabase/migrations/20250619000000_initial_schema.sql`](../supabase/migrations/20250619000000_initial_schema.sql)（仅全新空库需要）
2. [`supabase/migrations/20260719000000_phase11_enterprise.sql`](../supabase/migrations/20260719000000_phase11_enterprise.sql)（**推荐**：幂等，内含 Phase 1 基础表 + Phase 11）

若库不完整 / 曾报 `already exists` / `relation does not exist`：**只跑文件 2 即可**（整文件一次 Run）。

### 方式 A：SQL Editor（推荐，无需 CLI）

1. Dashboard → **SQL Editor** → **New query**
2. 复制 `20260719000000_phase11_enterprise.sql` **全部内容**并 **Run**
3. 确认无报错（可重复执行）

### 方式 B：Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

## 5. 迁移后刷新 API Schema Cache（必做）

SQL Editor 改表后，PostgREST 可能短暂找不到新表/新列（报错 `PGRST205` / `schema cache`）。在**同一项目**执行：

```sql
notify pgrst, 'reload schema';
```

仍无效时：Dashboard → **Project Settings** → **General** → **Pause project** 再 **Restore**（会短暂中断），或开 Support 里的 API restart。  
也可在 **Table Editor** 确认能看到 `profiles`；若看不到，说明迁移未落在当前项目。

---

## 6. 验证

在 SQL Editor 中运行：

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'audit_tasks',
    'audit_issues',
    'audit_reports',
    'knowledge_base',
    'profiles',
    'audit_issue_events',
    'audit_rule_configs'
  );
```

期望：`rowsecurity = true`（RLS 已启用）。

检查策略：

```sql
select tablename, policyname
from pg_policies
where schemaname = 'public'
order by tablename;
```

## 7. 表结构文档

完整表结构、RLS、索引、关系图见 **[`supabase/schema.md`](../supabase/schema.md)**（canonical，改库必更）。

| 表 | 说明 | RLS |
|----|------|-----|
| `audit_tasks` | 审计任务（user_id 隔离） | 仅本人 CRUD |
| `audit_issues` | 任务关联的风险项 | 通过 task 归属校验 |
| `audit_reports` | 每任务一份报告 | 通过 task 归属校验 |
| `knowledge_base` | RAG 政策片段 + vector(1536) | 已登录用户只读 |

## 8. 可选：种子知识库

通过 **service_role** 在服务端插入（Phase 7 脚本）。配置好 env 后运行：

```bash
npm run seed:kb
```

脚本会将 5 条审计政策片段写入 **Pinecone** 与 **`knowledge_base`** 表。

### 常见错误

| 报错 | 原因 | 处理 |
|------|------|------|
| `403 Country, region, or territory not supported` | OpenAI 在当前地区不可用 | 配置 `OPENAI_BASE_URL`，或改用 `AI_PROVIDER=qwen` + `DASHSCOPE_API_KEY` |
| `Connection error` | 无法连上 embedding 服务 | OpenAI：检查代理与 Key；Qwen：检查 `DASHSCOPE_API_KEY` 与 `DASHSCOPE_BASE_URL` |
| 维度不匹配 | Pinecone index 不是 1536 维 | 重建 **Dense 1536** index，名称 `auditlens`；Qwen v3/v4 须设 `QWEN_EMBED_DIMENSIONS=1536` |

Pinecone 控制台示例里的 `quickstart` 只是演示名；本项目 index 名应为 **`auditlens`**（与 `PINECONE_INDEX` 一致）。

也可手动 SQL：

```sql
insert into public.knowledge_base (content, category)
values
  ('同一 invoiceId 不得重复入账。', 'duplicate'),
  ('单笔金额超过历史均值 5 倍需二级审批。', 'anomaly');
```

## 9. Storage（线上整改附件）

1. 执行迁移 [`20260719100000_online_remediation.sql`](../supabase/migrations/20260719100000_online_remediation.sql)（会创建 private bucket `issue-remediation`）
2. Dashboard → **Storage** 确认 bucket 存在且 **Public** 关闭
3. 上传/下载由服务端 `SUPABASE_SERVICE_ROLE_KEY` 完成；浏览器只拿签名 URL

## 10. 类型与客户端

| 文件 | 用途 |
|------|------|
| `types/audit.ts` | 领域类型（AuditRecord, AuditGraphState 等） |
| `types/database.ts` | Supabase 表类型 + row mapper |
| `lib/supabase/client.ts` | 浏览器客户端 |
| `lib/supabase/server.ts` | Server Component / Route Handler |
| `lib/supabase/admin.ts` | service_role（仅 server） |

修改表结构后：更新迁移 SQL → **`supabase/schema.md`** → `types/database.ts`（见 `.cursor/rules/database.mdc`）。
