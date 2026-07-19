# AuditLens AI — 实施任务清单

> AI 代理实施本项目时，**严格按 Phase 顺序**推进。完成项将 `[ ]` 改为 `[x]`。规格细节见 [docs/init.md](./docs/init.md)，架构见 [PROJECT.md](./PROJECT.md)。  
> Phase 0–10 为 Demo 主线；**Phase 11–12** 为企业内落地（不含平台化）。平台化能力见文末「明确延期」。

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

- [x] `lib/ai-provider.ts` — `LLMProvider` 接口 + 工厂
- [x] 实现 `OpenAIProvider`（chat + embed）
- [x] （可选）`DeepSeekProvider` 占位
- [x] `lib/pinecone.ts` — `VectorStore` 接口 + Pinecone 实现
- [x] 单元 smoke：provider 工厂在缺 key 时优雅报错

**完成标准**：`server/` 仅通过工厂获取 LLM/向量客户端。

---

## Phase 5 — 审计引擎（确定性）

- [x] `server/rules.ts` — 重复 invoiceId、审批缺失
- [x] `server/anomaly.ts` — 金额异常（> avg×5）、供应商集中
- [x] `server/audit-engine.ts` — RiskScoring 公式
- [x] 纯函数测试或脚本验证样例 Excel

**完成标准**：给定 `Record[]` 可输出 issues、anomalies、score，无需 LLM。

---

## Phase 6 — LangGraph 编排

- [x] 安装 `@langchain/langgraph` 及相关依赖
- [x] `server/langgraph.ts` — 六节点 Graph + state 类型
- [x] ParseExcel 节点（xlsx/csv 解析 → `Record[]`）
- [x] 串联 RuleCheck → Anomaly → Scoring 节点
- [x] `app/api/audit/route.ts` — 接收上传、写 task、触发 graph

**完成标准**：API 上传样例文件后 task 状态变为 completed，issues 写入 DB。

---

## Phase 7 — RAG + LLM 解释

- [x] `server/rag.ts` — embed query → Pinecone search → context 组装
- [x] RAGExplain 节点 — risk + data + rule → LLM 解释
- [x] 知识库种子数据（审计政策片段）upsert 脚本或 API
- [x] issues 附带 `reason` 与建议字段

**完成标准**：高风险 issue 有 LLM 生成的中文解释，引用检索到的政策上下文。

---

## Phase 8 — 报告与 Dashboard 联调

- [x] ReportGeneration 节点 — Executive Summary / Findings / Recommendations
- [x] 写入 `audit_reports`；`app/report/[id]/page.tsx` 展示
- [x] Dashboard 拉取 tasks、score、issues 列表与图表
- [x] Upload 页分析按钮全链路打通

**完成标准**：Demo 路径「上传 Excel → 秒出风险 → 查看报告」可完整演示。

---

## Phase 9 — 打磨与交付

- [x] 加载态、错误态、空数据态
- [x] API 输入校验（文件类型、大小限制）
- [x] README：安装、env、启动、Demo 步骤
- [x] 生产构建与 lint 全绿
- [x] 更新本文件所有已完成项为 `[x]`

**完成标准**：比赛 Demo 可稳定复现。

---

## Phase 10 — 企业级 Demo 包

> Spec：[docs/superpowers/specs/2026-07-19-enterprise-demo-pack-design.md](./docs/superpowers/specs/2026-07-19-enterprise-demo-pack-design.md)

- [x] `metadata.evidence` 快照写入 persist
- [x] Executive Brief（管理层摘要 Top3）
- [x] IssueWorkbench：筛选 + 展开证据链
- [x] 报告发现项附带凭证表；客户端导出（下载/复制/打印）
- [x] 同步 `docs/business-decisions.md`

**完成标准**：上传 demo CSV → Brief → 展开证据 → 导出报告，2 分钟可演示。

---

## Phase 11 — 企业内可用（不含平台化）

> 目标：内审可用真实数据跑通，结果可跟进、可交代。  
> **不做**：多法人/多账套平台、GRC 对接、大规模私有化与等保整包、同时接多个外部系统。  
> 原则：规则判风险，LLM 只解释；先闭环，再谈更聪明。

- [x] 真制度知识库：导入本公司制度（报销/授权/采购等），条目带制度名 + 条款号；替换示意 `KNOWLEDGE_SEED_ENTRIES`
- [x] 规则阈值可配置：金额倍数、供应商占比、必审金额等进配置（按公司/事业部可选）；变更可追溯；命中结果写明规则 ID、阈值、证据行
- [x] Issue 工单闭环：状态 `待复核 → 确认风险 / 误报 → 整改中 → 已关闭`；记录操作人、时间、备注（audit trail）
- [x] 线上整改验收：业务提交说明+附件 → `待验收`；审计通过关闭/驳回；禁止业务直关（`20260719100000_online_remediation.sql`）
- [x] 简单角色权限：至少「审计看全量 / 业务只看分派给自己的项」；RLS 与分派字段配套
- [x] 底稿合规：证据行 + 规则版本 + AI 解释原文归档；导出报告带任务号、时间戳、操作人
- [x] 同步 `docs/business-decisions.md` / `supabase/schema.md`（若改表）

**完成标准**：真实（或脱敏）流水上传后，高风险项可确认/误报/分派整改并由审计验收关闭；RAG 引用可指向真制度条款。

---

## Phase 12 — 嵌进日常流程（不含平台化）

> 目标：减少反复人工上传；AI 解释进底稿前须人工确认。依赖 Phase 11 完成。

- [ ] 接 **1 个**主数据源（费控 / ERP 支出流水 API 或定时导出入库）；保留 CSV/Excel 上传作补充
- [ ] 抽检/计划任务：按期间、部门（可选供应商/金额层）发起任务，不必每次全量扫
- [ ] AI 解释门闩：高风险 LLM 输出须「人工确认」后方可写入正式底稿/报告
- [ ] 分派与提醒：高风险分派后企微/邮件通知；可选超时未整改提醒（轻量 SLA，非完整工单平台）
- [ ] 同步业务决策与 README 运维说明

**完成标准**：可不依赖手工上传完成一轮周期抽检；待办可分派、可通知、AI 结论可确认后入档。

---

## 明确延期 / 不做（平台化）

- [-] 多法人 / 多账套平台
- [-] 与 GRC / 内控评价系统深度对接
- [-] 大规模私有化部署与等保专项
- [-] 同时集成多个异构外部系统

---

## AI 代理工作协议

1. **一次只做一个 Phase 或其中一个子项**，避免跨 Phase 大范围改动
2. 开工前声明：`当前 Phase X · 子项 Y`
3. 完成后：勾选 todo、若架构有变则同步 `PROJECT.md` / `docs/architecture.md`；若业务决策有变则同步 `docs/business-decisions.md`（含变更日志）
4. 遇到阻塞：在对应子项下追加 `> 阻塞：原因`，不要静默跳过
5. 不要提前实现后续 Phase 的功能（除非当前 Phase 明确依赖）
6. **变更业务规则/阈值/评分/RAG 行为**：同一提交内更新 `docs/business-decisions.md`

---

## 进度总览

| Phase | 名称 | 状态 |
|-------|------|------|
| 0 | Harness & 脚手架 | `[x]` |
| 1 | 类型与数据模型 | `[x]` |
| 2 | 认证与路由保护 | `[x]` |
| 3 | UI 骨架 | `[x]` |
| 4 | AI 基础设施 | `[x]` |
| 5 | 审计引擎 | `[x]` |
| 6 | LangGraph | `[x]` |
| 7 | RAG + LLM | `[x]` |
| 8 | 报告与 Dashboard | `[x]` |
| 9 | 打磨与交付 | `[x]` |
| 10 | 企业级 Demo 包 | `[x]` |
| 11 | 企业内可用（不含平台化） | `[x]` |
| 12 | 嵌进日常流程（不含平台化） | `[ ]` |
| — | 平台化（多法人/GRC/等保等） | `[-]` 延期 |

**最后更新**：2026-07-19 — 线上整改验收（待验收状态 + 附件存证 + 审计关单）
