# AuditLens AI — 实施任务清单

> AI 代理实施本项目时，**严格按 Phase 顺序**推进。完成项将 `[ ]` 改为 `[x]`。规格细节见 [docs/init.md](./docs/init.md)，架构见 [PROJECT.md](./PROJECT.md)。

**状态图例**：`[ ]` 待做 · `[~]` 进行中 · `[x]` 完成 · `[-]` 跳过/延期

---

## Phase 0 — Harness & 脚手架

- [x] 初始化 Next.js 15 (App Router, TypeScript, Tailwind, ESLint)
- [x] 安装 shadcn/ui 并配置主题色（primary `#1E3A8A`）
- [x] 创建目标目录：`app/`, `components/`, `lib/`, `server/`, `types/`, `hooks/`
- [x] 添加 `.env.example`（Supabase、AI、Pinecone 变量）
- [x] 配置 `npm run typecheck`（`tsc --noEmit`）
- [x] 验证：`npm run dev` / `npm run build` / `npm run lint`

**完成标准**：空壳应用可启动，目录结构与 [AGENT.md](./AGENT.md) 一致。

---

## Phase 1 — 类型与数据模型

- [x] 定义 `types/audit.ts`（Record, Issue, Task, Report, GraphState）
- [x] 创建 Supabase 项目并配置 Auth（Email + Password）— 见 [docs/supabase-setup.md](./docs/supabase-setup.md)
- [x] 建表：`audit_tasks`, `audit_issues`, `audit_reports`, `knowledge_base` — 见 [supabase/migrations/20250619000000_initial_schema.sql](./supabase/migrations/20250619000000_initial_schema.sql)
- [x] 实现 `lib/supabase/client.ts`（浏览器）与服务端 client 辅助函数
- [x] Row Level Security：按 `user_id` 隔离

**完成标准**：类型可被 `server/` 与 `app/` 引用；迁移 SQL 或 Supabase dashboard 已记录。

---

## Phase 2 — 认证与路由保护

- [x] `app/login/page.tsx` — 登录表单
- [x] `hooks/useAuth.ts` — session 状态
- [x] `middleware.ts` — 保护 `/dashboard`, `/upload`, `/report/*`
- [x] 登录后跳转 `/dashboard`；未登录重定向 `/login`

**完成标准**：未登录无法访问受保护路由；登录后可见空 Dashboard。

---

## Phase 3 — UI 骨架

- [x] `app/layout.tsx` — 全局导航/侧栏
- [x] `app/dashboard/page.tsx` — KPI 占位 + IssueTable 占位
- [x] `app/upload/page.tsx` — UploadCard（拖拽区）
- [x] `components/UploadCard.tsx`
- [x] `components/RiskScoreCard.tsx`
- [x] `components/IssueTable.tsx`
- [x] `components/ReportViewer.tsx`

**完成标准**：四页面可导航，组件符合 Fintech 配色，无业务数据亦可渲染。

---

## Phase 4 — 可插拔 AI 基础设施

- [ ] `lib/ai-provider.ts` — `LLMProvider` 接口 + 工厂
- [ ] 实现 `OpenAIProvider`（chat + embed）
- [ ] （可选）`DeepSeekProvider` 占位
- [ ] `lib/pinecone.ts` — `VectorStore` 接口 + Pinecone 实现
- [ ] 单元 smoke：provider 工厂在缺 key 时优雅报错

**完成标准**：`server/` 仅通过工厂获取 LLM/向量客户端。

---

## Phase 5 — 审计引擎（确定性）

- [ ] `server/rules.ts` — 重复 invoiceId、审批缺失
- [ ] `server/anomaly.ts` — 金额异常（> avg×5）、供应商集中
- [ ] `server/audit-engine.ts` — RiskScoring 公式
- [ ] 纯函数测试或脚本验证样例 Excel

**完成标准**：给定 `Record[]` 可输出 issues、anomalies、score，无需 LLM。

---

## Phase 6 — LangGraph 编排

- [ ] 安装 `@langchain/langgraph` 及相关依赖
- [ ] `server/langgraph.ts` — 六节点 Graph + state 类型
- [ ] ParseExcel 节点（xlsx/csv 解析 → `Record[]`）
- [ ] 串联 RuleCheck → Anomaly → Scoring 节点
- [ ] `app/api/audit/route.ts` — 接收上传、写 task、触发 graph

**完成标准**：API 上传样例文件后 task 状态变为 completed，issues 写入 DB。

---

## Phase 7 — RAG + LLM 解释

- [ ] `server/rag.ts` — embed query → Pinecone search → context 组装
- [ ] RAGExplain 节点 — risk + data + rule → LLM 解释
- [ ] 知识库种子数据（审计政策片段）upsert 脚本或 API
- [ ] issues 附带 `reason` 与建议字段

**完成标准**：高风险 issue 有 LLM 生成的中文解释，引用检索到的政策上下文。

---

## Phase 8 — 报告与 Dashboard 联调

- [ ] ReportGeneration 节点 — Executive Summary / Findings / Recommendations
- [ ] 写入 `audit_reports`；`app/report/[id]/page.tsx` 展示
- [ ] Dashboard 拉取 tasks、score、issues 列表与图表
- [ ] Upload 页分析按钮全链路打通

**完成标准**：Demo 路径「上传 Excel → 秒出风险 → 查看报告」可完整演示。

---

## Phase 9 — 打磨与交付

- [ ] 加载态、错误态、空数据态
- [ ] API 输入校验（文件类型、大小限制）
- [ ] README：安装、env、启动、Demo 步骤
- [ ] 生产构建与 lint 全绿
- [ ] 更新本文件所有已完成项为 `[x]`

**完成标准**：比赛 Demo 可稳定复现。

---

## AI 代理工作协议

1. **一次只做一个 Phase 或其中一个子项**，避免跨 Phase 大范围改动
2. 开工前声明：`当前 Phase X · 子项 Y`
3. 完成后：勾选 todo、若架构有变则同步 `PROJECT.md` / `docs/architecture.md`
4. 遇到阻塞：在对应子项下追加 `> 阻塞：原因`，不要静默跳过
5. 不要提前实现后续 Phase 的功能（除非当前 Phase 明确依赖）

---

## 进度总览

| Phase | 名称 | 状态 |
|-------|------|------|
| 0 | Harness & 脚手架 | `[x]` |
| 1 | 类型与数据模型 | `[x]` |
| 2 | 认证与路由保护 | `[x]` |
| 3 | UI 骨架 | `[x]` |
| 4 | AI 基础设施 | `[ ]` |
| 5 | 审计引擎 | `[ ]` |
| 6 | LangGraph | `[ ]` |
| 7 | RAG + LLM | `[ ]` |
| 8 | 报告与 Dashboard | `[ ]` |
| 9 | 打磨与交付 | `[ ]` |

**最后更新**：2026-06-21 — Phase 3 UI 骨架完成
