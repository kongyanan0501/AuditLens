# AuditLens AI — Agent Instructions

> 面向 AI 编码代理的操作手册。架构细节见 [PROJECT.md](./PROJECT.md)，完整设计见 [docs/architecture.md](./docs/architecture.md)，任务进度见 [todo.md](./todo.md)。

## 项目定位

AuditLens AI 是面向审计/税务场景的智能风险分析系统：上传财务数据 → 规则+统计+向量检索 → LLM 解释 → 生成审计报告。

**技术栈**：Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui · LangGraph · Supabase · Pinecone

**当前阶段**：Greenfield MVP。以 [docs/init.md](./docs/init.md) 为功能规格，以 [todo.md](./todo.md) 为实施顺序。

---

## 开始修改前（必读）

1. 读 [PROJECT.md](./PROJECT.md) 确认模块边界与数据流
2. 查 [todo.md](./todo.md) 确认当前阶段与依赖
3. 只改与任务相关的文件，禁止无关重构
4. 遵循 `.cursor/rules/` 中对应 glob 的规则
5. 类型定义优先放 `types/`，跨层共享通过 `types/audit.ts`
6. 涉及数据库：先读 [`supabase/schema.md`](./supabase/schema.md)；改表后同步该文件（见下方「数据库 Schema」）

---

## 目录地图（目标结构）

```text
app/                  # Next.js 页面 + API Routes（UI 入口）
  login/              # Supabase Auth 登录
  dashboard/          # KPI、风险图表、问题列表
  upload/             # Excel/CSV 上传
  report/[id]/        # 报告查看
  api/                # 服务端 API（审计触发、状态查询）

components/           # 纯 UI 组件（无业务引擎逻辑）
lib/                  # 客户端/共享基础设施
  supabase/           # Supabase client
  ai-provider.ts      # LLM 工厂（可插拔）
  pinecone.ts         # 向量库封装

server/               # 服务端专用（禁止 client import）
  langgraph.ts        # LangGraph 编排入口
  audit-engine.ts     # 审计流水线协调
  rules.ts            # 确定性规则引擎
  anomaly.ts          # 统计异常检测
  rag.ts              # RAG 检索与上下文组装

types/                # 共享 TypeScript 类型
hooks/                # React hooks（如 useAuth）
middleware.ts         # 路由保护

supabase/             # 数据库
  schema.md           # 表结构 canonical 文档（改库必更）
  migrations/         # SQL 迁移
```

### 模块归属

| 路径 | 职责 | 禁止 |
|------|------|------|
| `app/` | 路由、页面、API 薄层 | 不写规则/异常/RAG 核心逻辑 |
| `components/` | 展示组件 | 不直接调 Pinecone/LLM |
| `lib/` | 基础设施、工厂、客户端 SDK | 不 import `server/` |
| `server/` | 审计引擎、LangGraph、业务算法 | 不 import React/客户端 hook |
| `types/` | 领域类型（Record、Issue、Task） | 不含运行时代码 |

---

## 核心数据流

```text
Upload (Excel/CSV)
  → API Route
  → LangGraph: ParseExcel → RuleCheck → AnomalyDetection → RiskScoring → RAGExplain → ReportGeneration
  → Supabase 持久化 (audit_tasks / audit_issues / audit_reports)
  → Dashboard / Report UI
```

**LangGraph 节点顺序不可打乱**，除非同步更新 `docs/architecture.md` 与 `server/langgraph.ts`。

---

## 可插拔边界（必须遵守）

```ts
// LLM — 只通过 lib/ai-provider.ts 工厂获取
interface LLMProvider { chat(); embed(); }

// 向量库 — 只通过 lib/pinecone.ts 或 VectorStore 接口
interface VectorStore { upsert(); search(); }
```

新增 Provider 时：实现接口 → 注册工厂 → 更新 `.env.example`，**不**在业务节点内直接 `new OpenAI()`。

---

## 命令（项目初始化后）

```bash
npm install
npm run dev          # 本地开发 http://localhost:3000
npm run build        # 生产构建
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit（若已配置）
npm run codegraph:sync  # major 版本变更后重建 CodeGraph 索引
```

### CodeGraph（代码图谱）

本项目已集成 [CodeGraph](https://github.com/colbymchenry/codegraph) MCP，用于结构化代码探索。

```bash
# 全局安装 CLI（一次性）
npm i -g @colbymchenry/codegraph

# 项目内已配置 .cursor/mcp.json；新 clone 后初始化索引
codegraph init

# major 版本变更后重建索引（npm version major 会自动触发）
npm run codegraph:sync
```

- **日常**：文件保存后 CodeGraph 自动 sync，无需手动操作
- **重启 Cursor** 后 MCP 才会加载（修改 mcp.json 后必做）
- **规则**：见 `.cursor/rules/codegraph.mdc` 与下方 CodeGraph 段

<!-- codegraph:start -->
探索代码结构时优先 `codegraph explore` / MCP `codegraph_explore`；读单文件用 `codegraph node` / `codegraph_node`。
<!-- codegraph:end -->

环境变量（`.env.local`，**勿提交**）：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
AI_PROVIDER=openai          # openai | deepseek | claude
OPENAI_API_KEY=
PINECONE_API_KEY=
```

---

## 编码约定

- **语言**：TypeScript strict；UI 文案中文，代码/标识符英文
- **组件**：函数组件 + named export；shadcn/ui 优先
- **样式**：Tailwind；企业级 Fintech 配色见 `docs/architecture.md` § UI
- **API**：Route Handler 薄层，重逻辑委托 `server/`
- **错误**：API 返回结构化 `{ error, code }`；服务端 log 带 `taskId`
- **提交**：小步、单 concern；完成 todo 项后勾选 [todo.md](./todo.md)

---

## 安全边界

- **禁止**硬编码 API Key、Supabase service role key
- **禁止**在 client 组件暴露 `PINECONE_API_KEY` / `OPENAI_API_KEY`
- **必须**通过 Supabase Auth + `middleware.ts` 保护 `/dashboard`、`/upload`、`/report`
- **必须**按 `user_id` 隔离 `audit_tasks` 查询
- RAG 知识库写入仅允许服务端 Route / server 模块

---

## 验证清单（每次功能 PR 前）

- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过
- [ ] 改动范围与 todo 项一致
- [ ] 新 env 变量已写入 `.env.example`
- [ ] 跨层 import 方向正确（`server/` ↛ `components/`）
- [ ] 若变更数据库：`supabase/schema.md` 与 `types/database.ts` 已同步

---

## 数据库 Schema

**Canonical 文档**：[`supabase/schema.md`](./supabase/schema.md) — 所有表、列、RLS、索引、关系的唯一记录。

每次更新数据库后必须同步：

| 文件 | 说明 |
|------|------|
| `supabase/migrations/*.sql` | 可复现迁移 |
| **`supabase/schema.md`** | 结构文档 + 变更日志 |
| `types/database.ts` | Supabase 类型 |
| `types/audit.ts` | 领域类型（列语义变化时） |

规则详情：`.cursor/rules/database.mdc`

---

## Cursor 规则索引

| 规则文件 | 作用域 |
|----------|--------|
| `.cursor/rules/core.mdc` | 全局 |
| `.cursor/rules/codegraph.mdc` | 全局（CodeGraph 使用 + 架构导航） |
| `.cursor/rules/nextjs-app.mdc` | `app/**`, `components/**` |
| `.cursor/rules/server-audit.mdc` | `server/**` |
| `.cursor/rules/database.mdc` | `supabase/**`, `types/database.ts` |
| `.cursor/rules/ai-layer.mdc` | `lib/ai-provider.ts`, `lib/pinecone.ts`, `server/rag.ts`, `server/langgraph.ts` |

---

## 常见任务导航

| 任务 | 先读 | 主要改 |
|------|------|--------|
| 登录/鉴权 | init.md §4 | `app/login`, `middleware.ts`, `hooks/useAuth.ts` |
| 上传解析 | init.md §8.1-8.2 | `app/upload`, `server/langgraph.ts` ParseExcel 节点 |
| 风险规则 | init.md §8.3 | `server/rules.ts`, `server/anomaly.ts` |
| RAG 解释 | init.md §6 | `server/rag.ts`, `lib/pinecone.ts` |
| 报告生成 | init.md §8.6 | LangGraph ReportGeneration 节点, `components/ReportViewer.tsx` |
| 数据模型 | [supabase/schema.md](./supabase/schema.md), init.md §9 | migration / `types/database.ts` / `types/audit.ts` |

---

## 文档层级

```text
AGENT.md          ← 你正在读：操作指令、边界、命令
PROJECT.md        ← 架构地图：入口、模块、风险区
todo.md           ← 实施任务与进度
supabase/schema.md ← 数据库表结构 canonical（改库必更）
docs/init.md      ← MVP 功能规格（产品需求）
docs/architecture.md ← 完整架构与 harness 说明
```
