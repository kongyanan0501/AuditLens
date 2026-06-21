# AuditLens — Database Schema（Canonical）

> **数据库结构的唯一文档源。** 任何 schema 变更后必须同步更新本文件。  
> 来源迁移：[`migrations/20250619000000_initial_schema.sql`](./migrations/20250619000000_initial_schema.sql)  
> 最后同步：**2026-06-19** · Phase 1 initial

---

## 变更同步清单（必做）

修改数据库（新增 migration、SQL Editor 执行、Dashboard 改表）后，**同一 PR / 同一次提交**内完成：

| # | 文件 | 动作 |
|---|------|------|
| 1 | `supabase/migrations/<timestamp>_<name>.sql` | 新增或更新迁移 SQL |
| 2 | **`supabase/schema.md`（本文件）** | 更新表结构、RLS、索引、关系图 |
| 3 | `types/database.ts` | 同步 `Database` 类型与 row mapper |
| 4 | `types/audit.ts` | 若领域模型变化，同步 AuditTask 等 |
| 5 | `docs/supabase-setup.md` | 若配置步骤变化则更新 |

---

## ER 关系

```mermaid
erDiagram
  auth_users ||--o{ audit_tasks : owns
  audit_tasks ||--o{ audit_issues : has
  audit_tasks ||--o| audit_reports : has_one

  auth_users {
    uuid id PK
  }

  audit_tasks {
    uuid id PK
    uuid user_id FK
    text file_name
    text status
    int score
    timestamptz created_at
    timestamptz updated_at
  }

  audit_issues {
    uuid id PK
    uuid task_id FK
    text type
    text severity
    text reason
    jsonb metadata
    timestamptz created_at
  }

  audit_reports {
    uuid id PK
    uuid task_id FK UK
    text content
    timestamptz created_at
  }

  knowledge_base {
    uuid id PK
    text content
    vector embedding
    text category
    timestamptz created_at
  }
```

---

## Extensions

| Extension | Schema | 用途 |
|-----------|--------|------|
| `vector` | `extensions` | `knowledge_base.embedding`（1536 维，OpenAI text-embedding-3-small） |

---

## Tables

### `public.audit_tasks`

审计任务主表，按 `user_id` 隔离。

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | 任务 ID |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | 所属用户 |
| `file_name` | `text` | NOT NULL | 上传文件名 |
| `status` | `text` | NOT NULL, default `'pending'`, CHECK | `pending` \| `running` \| `completed` \| `failed` |
| `score` | `integer` | CHECK NULL OR 0–100 | 风险评分 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | 创建时间 |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | 更新时间（trigger 维护） |

**Indexes**

| 名称 | 列 |
|------|-----|
| `audit_tasks_user_id_idx` | `user_id` |
| `audit_tasks_status_idx` | `status` |

**Triggers**

| 名称 | 事件 | 函数 |
|------|------|------|
| `audit_tasks_set_updated_at` | BEFORE UPDATE | `public.set_updated_at()` |

---

### `public.audit_issues`

任务关联的风险项（规则 / 异常产出）。

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Issue ID |
| `task_id` | `uuid` | NOT NULL, FK → `audit_tasks(id)` ON DELETE CASCADE | 所属任务 |
| `type` | `text` | NOT NULL | 如 `duplicate`, `anomaly`, `approval`, `vendor_concentration` |
| `severity` | `text` | NOT NULL, CHECK | `low` \| `medium` \| `high` |
| `reason` | `text` | NOT NULL | 规则说明或 LLM 解释 |
| `metadata` | `jsonb` | NOT NULL, default `'{}'` | 关联 record 等扩展字段 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | 创建时间 |

**Indexes**

| 名称 | 列 |
|------|-----|
| `audit_issues_task_id_idx` | `task_id` |

---

### `public.audit_reports`

每个任务唯一一份审计报告。

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Report ID |
| `task_id` | `uuid` | NOT NULL, UNIQUE, FK → `audit_tasks(id)` ON DELETE CASCADE | 所属任务（1:1） |
| `content` | `text` | NOT NULL | Markdown 报告正文 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | 创建时间 |

---

### `public.knowledge_base`

RAG 政策 / 规则知识片段。

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | 条目 ID |
| `content` | `text` | NOT NULL | 政策原文 |
| `embedding` | `extensions.vector(1536)` | nullable | 向量（服务端写入） |
| `category` | `text` | nullable | 分类标签 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | 创建时间 |

**Indexes**

| 名称 | 列 |
|------|-----|
| `knowledge_base_category_idx` | `category` |

---

## Functions

### `public.set_updated_at()`

| 属性 | 值 |
|------|-----|
| 语言 | `plpgsql` |
| 用途 | UPDATE 时自动设置 `updated_at = now()` |
| 安全 | INVOKER（默认） |

---

## Row Level Security

所有 `public` 业务表均已 **ENABLE ROW LEVEL SECURITY**。

### `audit_tasks`

| Policy | 操作 | 角色 | 条件 |
|--------|------|------|------|
| `audit_tasks_select_own` | SELECT | `authenticated` | `auth.uid() = user_id` |
| `audit_tasks_insert_own` | INSERT | `authenticated` | WITH CHECK `auth.uid() = user_id` |
| `audit_tasks_update_own` | UPDATE | `authenticated` | USING + WITH CHECK `auth.uid() = user_id` |
| `audit_tasks_delete_own` | DELETE | `authenticated` | `auth.uid() = user_id` |

### `audit_issues` / `audit_reports`

通过所属 `audit_tasks.user_id = auth.uid()` 校验（EXISTS 子查询）。  
UPDATE 策略均包含 **USING + WITH CHECK**（防 `user_id` 被篡改转移归属）。

| 表 | Policies | 操作 |
|----|----------|------|
| `audit_issues` | `*_select_own`, `*_insert_own`, `*_update_own`, `*_delete_own` | CRUD |
| `audit_reports` | 同上 | CRUD |

### `knowledge_base`

| Policy | 操作 | 角色 | 条件 |
|--------|------|------|------|
| `knowledge_base_select_authenticated` | SELECT | `authenticated` | `true`（只读） |

写入通过 **service_role** 或 migration 种子完成；authenticated 无 INSERT/UPDATE/DELETE policy。

---

## Grants

```sql
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_issues TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_reports TO authenticated;
GRANT SELECT ON public.knowledge_base TO authenticated;
```

---

## TypeScript 映射

| DB 表 | `types/database.ts` | 领域类型 `types/audit.ts` |
|-------|---------------------|---------------------------|
| `audit_tasks` | `Tables.audit_tasks` | `AuditTask`（via `mapTaskRow`） |
| `audit_issues` | `Tables.audit_issues` | `AuditIssue`（via `mapIssueRow`） |
| `audit_reports` | `Tables.audit_reports` | `AuditReport`（via `mapReportRow`） |
| `knowledge_base` | `Tables.knowledge_base` | `KnowledgeEntry` |

---

## 变更日志

| 日期 | Migration | 说明 |
|------|-----------|------|
| 2026-06-19 | `20250619000000_initial_schema.sql` | 初始 4 表 + pgvector + RLS + grants |
