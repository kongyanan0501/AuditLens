# AuditLens — 业务决策文档

> **Canonical 文档**：产品规则、阈值、评分、RAG/LLM 行为等业务决策的唯一记录源。  
> 操作指令：[AGENT.md](../AGENT.md) · 架构：[PROJECT.md](../PROJECT.md) · 规格：[init.md](./init.md)

---

## 维护协议（强制）

### 何时必须更新本文档

在同一提交内更新 **`docs/business-decisions.md`**，当且仅当改动涉及以下任一内容：

| 类别 | 示例 |
|------|------|
| 规则阈值 | 重复判定、审批缺失、金额倍数、供应商占比 |
| 评分公式 | 扣分权重、上下界、计数口径 |
| 解析语义 | 列映射、必填字段、类型/金额归一化 |
| 流水线行为 | LangGraph 节点顺序、哪些 issue 走 LLM |
| RAG/LLM | topK、prompt 输出结构、降级策略 |
| API 业务约束 | 文件类型/大小、任务状态流转 |
| 持久化语义 | `reason` / `metadata` 字段含义 |
| 认证与隔离 | 谁能读/写哪些业务数据 |

**不算业务决策**（无需改本文档）：纯 UI 样式、重构不改行为、依赖升级、测试/脚手架。

### 更新步骤

1. 修改代码前：读本文档对应章节，确认是否与现有决策冲突  
2. 若 intentionally 变更决策：先改代码，**同一提交**内更新本文档对应章节  
3. 在 **[变更日志](#变更日志)** 追加一行（日期、摘要、涉及模块）  
4. 若决策影响对外规格，同步检查 [init.md](./init.md) / [architecture.md](./architecture.md) 是否需要摘要更新（细节仍以本文档为准）

### 与代码的对应关系

| 文档章节 | 主要代码 |
|----------|----------|
| §2 上传与解析 | `app/api/audit/route.ts`, `server/parse-excel.ts`, `lib/upload-constraints.ts` |
| §3 规则引擎 | `server/rules.ts`, `server/rule-config.ts` |
| §4 异常检测 | `server/anomaly.ts`, `server/rule-config.ts` |
| §5 风险评分 | `server/audit-engine.ts`, `types/audit.ts` |
| §6 RAG + LLM | `server/rag.ts`, `server/langgraph.ts` |
| §7 持久化 | `server/audit-repository.ts`, `types/audit.ts` |
| §8 认证隔离 | `middleware.ts`, `server/profiles.ts`, `supabase/schema.md` |
| §11 报告生成 | `server/report.ts`, `components/ReportViewer.tsx` |
| §16 工单与角色 | `server/issue-workflow.ts`, `components/IssueWorkbench.tsx` |

---

## 变更日志

| 日期 | 摘要 | 模块 |
|------|------|------|
| 2026-07-19 | 整改分派改为**项目级**：一任务一名业务对接人；`POST /api/tasks/[id]/assign` 批量写入 issue.assignee | `server/issue-workflow.ts`, `components/IssueWorkbench.tsx` |
| 2026-07-19 | 分派改用业务用户邮箱（库内仍存 UUID）；工作台展示邮箱 | `server/profiles.ts`, `components/IssueWorkbench.tsx` |
| 2026-07-19 | 线上整改验收：业务提交说明+附件→待验收；审计通过关闭/驳回；禁止业务直关 | `server/issue-workflow.ts`, `server/issue-attachments.ts`, `supabase/migrations/20260719100000_online_remediation.sql` |
| 2026-07-19 | 修复业务角色 Dashboard RLS 无限递归（`42P17`）：跨表可见性改 SECURITY DEFINER 函数 | `supabase/migrations/20260719030000_phase11_fix_rls_recursion.sql` |
| 2026-07-19 | Phase 11 验收修补：auditor RLS 全量、业务 Dashboard「我的待办」、制度种子≥2/类、`《制度》条款` 引用、规则变更历史、非法流转 409 | `supabase/migrations/20260719020000_phase11_rls_auditor_scope.sql`, `app/dashboard/page.tsx`, `server/rag.ts`, `server/rule-config.ts` |
| 2026-07-19 | Phase 11 收口：任务 `rule_config_version`、导出含规则版本、变更备注必填、业务仅 remediating→closed、演示角色切换需 `ALLOW_DEMO_ROLE_SWITCH`、`/settings/rules` | `server/audit-repository.ts`, `lib/report-export.ts`, `app/settings/rules/page.tsx` |
| 2026-07-19 | Phase 11：制度条款知识库、可配置规则阈值（版本追溯）、Issue 工单闭环、审计/业务角色与 RLS、底稿归档与导出元数据 | `server/rule-config.ts`, `server/issue-workflow.ts`, `server/profiles.ts`, `supabase/migrations/20260719000000_phase11_enterprise.sql` |
| 2026-07-19 | 企业 Demo 包：`metadata.evidence` 快照、Executive Brief、Issue 工作台筛选/展开、报告客户端导出 | `server/evidence.ts`, `server/brief.ts`, `components/IssueWorkbench.tsx`, `components/ReportActions.tsx` |
| 2026-06-22 | Phase 9：上传校验共享化、加载/错误/空态、README Demo 指南 | `lib/upload-constraints.ts`, `app/*/loading.tsx`, `README.md` |
| 2026-06-21 | Phase 8：ReportGeneration 结构化报告、Dashboard 任务列表与风险分布图、Upload 全链路 | `server/report.ts`, `app/dashboard/page.tsx` |
| 2026-06-21 | 新增 `AI_PROVIDER=qwen`（DashScope chat + embed），RAG/seed 支持 `DASHSCOPE_API_KEY` | `lib/ai-provider.ts`, `server/rag.ts`, `scripts/seed-knowledge-base.ts` |
| 2026-06-21 | 初版：汇总 Phase 1–7 已落地的规则、评分、RAG、API 约束 | 全文档 |

---

## 1. 审计流水线

| 决策 | 说明 |
|------|------|
| **节点顺序固定** | `ParseExcel → RuleCheck → AnomalyDetection → RiskScoring → RAGExplain → ReportGeneration` |
| **失败短路** | ParseExcel 失败则 `status=failed`，不进入后续节点 |
| **RAG 可选** | 缺少 LLM Key（`OPENAI_API_KEY` 或 `DASHSCOPE_API_KEY`，视 `AI_PROVIDER`）或 `PINECONE_API_KEY` 时跳过 LLM，保留确定性结果 |
| **ReportGeneration** | 生成 Markdown 报告（执行摘要 / 发现项 / 风险分析 / 整改建议）；有 LLM Key 时 AI 增强，否则确定性模板；LLM 失败降级为模板 |

实现：`server/langgraph.ts`, `server/report.ts`

---

## 2. 数据上传与解析

### 2.1 上传 API（`POST /api/audit`）

| 决策 | 值 |
|------|-----|
| 允许格式 | `.xlsx`, `.xls`, `.csv` |
| 最大体积 | 5 MB |
| 空文件 | 拒绝 |
| 鉴权 | 须登录；`audit_tasks.user_id = auth.uid()` |
| 失败响应 | 422 + `taskId`（已创建 task 时） |
| 校验实现 | 服务端与客户端共用 `lib/upload-constraints.ts` |

### 2.2 财务行模型（`AuditRecord`）

必填列（中/英表头均可，见别名表）：

- `date` / 日期  
- `type` / 类型  
- `amount` / 金额  
- `vendor` / 供应商  
- `invoiceId` / 发票号  

可选：`category`, `department`, `region`, `approvedBy`

### 2.3 类型归一化

| 输入 | 归一化为 |
|------|----------|
| income, in, 收入, 收 | `income` |
| expense, out, 支出, 支, 费用 | `expense` |
| 其他 | 解析错误 |

### 2.4 金额

- 支持数字或去逗号字符串  
- 空或非数字 → 解析错误  

实现：`server/parse-excel.ts`

---

## 3. 规则引擎（确定性）

### 3.0 可配置阈值（Phase 11）

| 项 | 决策 |
|----|------|
| 存储 | `audit_rule_configs`；每 `scope_key`（默认 `default`）一条 `is_active` |
| 字段 | `amount_anomaly_multiplier`、`vendor_concentration_threshold`、`approval_required_min_amount` |
| 变更 | 发布新版本（旧版 `is_active=false`），**须填** `change_note`；记录 `changed_by` / `version` |
| 运行时 | 上传分析时读取生效配置写入 graph `ruleConfig`；完成后写入 `audit_tasks.rule_config_version` |
| 命中元数据 | `metadata.ruleId` + `ruleVersion` + `scopeKey` + `thresholds` |
| 规则 ID | `R-DUP-001` / `R-APR-001` / `R-ANM-001` / `R-VEN-001` |
| 默认值 | 倍数 5、集中度 0.5、必审金额 0（全部支出需审批） |
| 生效范围 | 仅影响**之后新跑**任务；已落库 issue 不回溯 |

实现：`server/rule-config.ts`；UI：`/settings/rules` 与 `/me` → `RuleConfigForm`（仅审计角色）

### 3.1 重复发票（`duplicate`）

| 项 | 决策 |
|----|------|
| 触发条件 | 同一 `invoiceId`（trim 后非空）出现 **> 1** 次 |
| 严重程度 | **high** |
| 空 invoiceId | 不参与重复统计 |
| 规则 ID | `R-DUP-001` |

### 3.2 审批缺失（`approval`）

| 项 | 决策 |
|----|------|
| 触发条件 | `type === expense` 且 `amount ≥ approval_required_min_amount` 且 `approvedBy` 为空/空白 |
| 严重程度 | **medium** |
| 收入记录 | 不检查审批 |
| 必审金额 0 | 兼容原行为：全部支出须审批 |
| 规则 ID | `R-APR-001` |

实现：`server/rules.ts`

---

## 4. 异常检测（统计）

### 4.1 金额异常（`anomaly`）

| 项 | 决策 |
|----|------|
| 阈值 | `amount > 全体记录均值 × amount_anomaly_multiplier`（默认 5） |
| 均值为 0 | 不检测 |
| 严重程度 | `amount ≥ 均值×倍数×2` → **high**；否则 **medium** |
| 规则 ID | `R-ANM-001` |

### 4.2 供应商集中（`vendor_concentration`）

| 项 | 决策 |
|----|------|
| 统计范围 | 仅 **expense** 且 vendor 非空 |
| 阈值 | 单一 vendor 支出金额占比 **> vendor_concentration_threshold**（默认 0.5） |
| 严重程度 | 占比 **≥ min(0.7, 阈值+0.2)** → **high**；否则 **medium** |
| 规则 ID | `R-VEN-001` |

实现：`server/anomaly.ts`

---

## 5. 风险评分

### 5.1 MVP 公式

```text
score = 100
      - duplicates × 10
      - anomalies × 5
      - missingApproval × 8
```

结果 clamp 到 **[0, 100]**。

### 5.2 计数口径

| 变量 | 来源 |
|------|------|
| `duplicates` | `issues` 中 `type === duplicate` 条数 |
| `missingApproval` | `issues` 中 `type === approval` 条数 |
| `anomalies` | `anomalies.length` + `issues` 中 `type ∈ {anomaly, vendor_concentration}` |

常量定义：`types/audit.ts` → `RISK_SCORE_WEIGHTS`  
实现：`server/audit-engine.ts`

---

## 6. RAG + LLM 解释

### 6.1 解释范围

| 决策 | 说明 |
|------|------|
| **仅高风险** | 只对 `severity === high` 的 issue / anomaly 调用 LLM |
| 中/低风险 | 保留规则引擎原始 `reason`，不调用 LLM |

### 6.2 检索

| 项 | 值 |
|----|-----|
| 向量库 | Pinecone（`PINECONE_INDEX`，默认 `auditlens`） |
| LLM Provider | `AI_PROVIDER`：`openai`（默认）或 `qwen`（阿里云百炼 DashScope） |
| Embedding | OpenAI `text-embedding-3-small`（1536 维）；或 Qwen `text-embedding-v2`（1536 维，默认）；v3/v4 须 `QWEN_EMBED_DIMENSIONS=1536` |
| Chat | OpenAI 默认 `gpt-4o-mini`；Qwen 默认 `qwen-plus` |
| topK | **5** |
| Query 构成 | 类型 + 严重程度 + 规则说明 + metadata JSON |

### 6.3 LLM 输出

Prompt 要求返回 JSON：

```json
{
  "summary": "为什么构成风险",
  "ruleReference": "引用的政策要点",
  "recommendation": "整改建议"
}
```

解析失败时：`summary` 取原文截断，`recommendation` 使用通用兜底文案。

### 6.4 写回 state

| 字段 | 决策 |
|------|------|
| `reason` | 替换为 LLM `summary` |
| `metadata.originalReason` | 保留规则引擎初判 |
| `metadata.ruleReference` | 政策引用 |
| `metadata.recommendation` | 整改建议 |
| `metadata.llmExplained` | `true` |
| `metadata.evidence` | 关联凭证快照（见 §7） |

单条 LLM 失败：**跳过该条**，不影响其余高风险项与流水线。

### 6.5 知识库种子（制度条款）

| 项 | 决策 |
|----|------|
| 条目数 | 8 条；报销 / 授权 / 采购制度各 ≥2 条，另含异常监控与内控通则 |
| 结构 | 每条含 `policyName`（制度名）+ `clauseId`（条款号）+ 正文 |
| 向量正文 | `【《制度名》条款号】` + 正文（`formatKnowledgeSeedText`） |
| Pinecone metadata | `content`, `category`, `policyName`, `clauseId` |
| DB 列 | `knowledge_base.policy_name` / `clause_id` |
| 写入目标 | Pinecone + Supabase `knowledge_base` |
| 脚本 | `npm run seed:kb`（更新制度后须重跑） |
| ID | 固定 UUID（可重复 upsert） |
| 引用格式 | `ruleReference` = `《{policyName}》{clauseId}`；LLM 缺省时用检索命中首条 metadata 回填 |

条目：`server/rag.ts` → `KNOWLEDGE_SEED_ENTRIES`  
实现：`server/rag.ts`, `scripts/seed-knowledge-base.ts`

---

## 7. 持久化与 Issue 字段

| 决策 | 说明 |
|------|------|
| issues 来源 | `state.issues` + `state.anomalies` 均写入 `audit_issues` |
| `reason` 列 | 规则初判或 LLM 增强后的说明 |
| 建议字段 | 无独立 DB 列；存 `metadata.recommendation` |
| **证据快照** | `metadata.evidence[]`：由 `recordIndex` / `recordIndices` 对照 `state.records` 在 persist 时写入；字段含 date/type/amount/vendor/invoiceId/approvedBy 等；无索引则不写 |
| **底稿归档** | persist 时写入 `metadata.workpaper`：ruleId/version/thresholds、evidence、originalReason、aiExplanation、ruleReference、recommendation、archivedAt |
| 报告 | 每 task 一份 `audit_reports.content`（Markdown：执行摘要 / 发现项 / 风险分析 / 整改建议）；发现项含规则 ID/阈值与关联凭证表 |
| 报告导出 | 客户端下载 `.md` / 复制全文 / 打印；导出正文追加任务号、时间戳、操作人、规则配置版本（`lib/report-export.ts`） |
| 任务规则版本 | `audit_tasks.rule_config_version` = 运行时所用配置版本 |
| **Executive Brief** | Dashboard 纯函数派生：风险结论、问题/高风险数、优先整改 Top3、评分解读；不另存表；不额外调 LLM |
| task 终态 | 成功 → `completed` + `score`；解析失败 → `failed` |
| issue 初态 | `workflow_status = pending_review` |

实现：`server/audit-repository.ts`, `server/evidence.ts`, `server/brief.ts`, `lib/report-export.ts`

---

## 8. 认证与数据隔离

| 决策 | 说明 |
|------|------|
| 受保护路由 | `/dashboard`, `/upload`, `/report/*`, `/me`, `/settings/*` |
| 角色 | `profiles.role`：`auditor`（默认）\| `business`；默认禁止自提权；仅 `ALLOW_DEMO_ROLE_SWITCH=true` 时「我的」页可切换 |
| 上传 / 规则配置 | **仅 auditor**（页面重定向 + API 403）；导航对 business 隐藏 |
| Dashboard | auditor：任务列表 + 全量 issues；business：**我的待办**（`listAssignedIssues`），不展示全量任务历史 |
| `audit_tasks` SELECT | auditor **或** owner **或** 任务上存在分派给自己的 issue |
| `audit_issues` | auditor 全量；business 仅 `assignee_id = auth.uid()` |
| `audit_reports` | auditor **或** owner **或** 任务上有分派给自己的 issue |
| `knowledge_base` | 已登录用户只读；写入仅 service_role / seed 脚本 |
| 禁止 | 用 `user_metadata` 做授权 |

详见：[supabase/schema.md](../supabase/schema.md)

---

## 9. UI 与文案

| 决策 | 说明 |
|------|------|
| 面向用户文案 | **中文** |
| 代码/标识符 | **英文** |
| Issue 类型展示 | duplicate→重复发票, anomaly→金额异常, approval→审批缺失, vendor_concentration→供应商集中 |
| Dashboard 工作台 | 管理层摘要 + 项目级分派条 + Issue 筛选（严重程度/类型/工单状态/仅 AI）+ 行展开证据链与工单操作 |
| 旧任务无 evidence | UI 显示「无关联明细快照」，不报错 |

实现：`components/IssueTable.tsx`, `components/IssueWorkbench.tsx`, `components/ExecutiveBrief.tsx`

---

## 16. Issue 工单闭环（Phase 11）

| 项 | 决策 |
|----|------|
| 状态机 | `待复核 → 确认风险 / 误报 → 整改中 → 待验收 → 已关闭`（可重新打开为待复核；误报可直关） |
| 轨迹 | `audit_issue_events` 记录 from/to、操作人、时间、备注 |
| 审计角色 | 可确认/误报；项目级分派整改；对「待验收」通过关闭或驳回（驳回须备注）；**不可**从整改中直关 |
| 分派粒度 | **任务级**：一项目一名业务对接人；不按问题逐条分派（UI 主路径） |
| 分派范围 | `confirmed` → `remediating` + assignee；已在 `remediating` 的可改对接人；其余状态跳过 |
| 分派标识 | UI/API 使用**邮箱**；对象须为 `profiles.role = business`；库内仍存 `assignee_id` UUID |
| 业务角色 | 仅可操作分派给自己的项；**仅** `remediating → pending_verification` |
| 提交验收 | 措施/完成说明各 ≥10 字；至少 1 个附件（截图/PDF 或修正版流水）；修正文件只存证、不重跑规则 |
| 附件 | `audit_issue_attachments` + Storage `issue-remediation`；remediating 时可删本人附件 |
| 重新打开 | 非终态回到 `pending_review` 时须填备注 |
| API | `POST /api/tasks/[id]/assign`（项目分派）；`PATCH /api/issues/[id]`；`GET/POST/DELETE /api/issues/[id]/attachments` |

实现：`server/issue-workflow.ts`, `server/issue-attachments.ts`, `app/api/tasks/[id]/assign/route.ts`, `app/api/issues/[id]/route.ts`, `components/IssueWorkbench.tsx`

---

## 11. 报告生成（ReportGeneration）

| 决策 | 说明 |
|------|------|
| 结构 | `## 执行摘要` · `## 发现项` · `## 风险分析` · `## 整改建议` |
| LLM | 有 API Key 时调用 chat 生成；输出须含四个二级标题 |
| 降级 | 无 Key / LLM 失败 / 格式不合规 → `buildDeterministicReport` 模板 |
| 发现项 | 按问题类型分组；含严重程度与 `metadata.recommendation`（若有） |
| 风险分析 | 表格汇总评分、问题分布与评分公式说明 |

实现：`server/report.ts`, `server/langgraph.ts`, `components/ReportViewer.tsx`

---

## 12. Dashboard 数据联调

| 决策 | 说明 |
|------|------|
| 任务列表 | 最近 8 条 `audit_tasks`，按 `created_at` 降序 |
| 默认任务 | 无 `?taskId=` 时展示最近一条 `status=completed` 任务 |
| 图表 | `RiskDistributionChart` 按 issue 类型统计柱状分布 |
| 上传跳转 | 分析成功后跳转 `/dashboard?taskId=…` |

实现：`server/audit-queries.ts`, `app/dashboard/page.tsx`, `components/UploadCard.tsx`

---

## 14. UI 状态与体验（Phase 9）

| 决策 | 说明 |
|------|------|
| 加载态 | `dashboard` / `upload` / `report/[id]` 路由提供 `loading.tsx` 骨架屏 |
| 错误态 | 根 `error.tsx` 全局错误边界；`AlertBanner` 展示任务失败/未找到 |
| 空数据态 | `EmptyState` 用于无任务、无 issue、无报告；Dashboard 引导上传 |
| 404 | 根 `not-found.tsx`；报告页 `report/[id]/not-found.tsx` |
| 客户端校验 | 选文件时调用 `validateUploadFile`，与 API 规则一致 |

实现：`components/EmptyState.tsx`, `components/AlertBanner.tsx`, `components/PageLoadingSkeleton.tsx`, `components/UploadCard.tsx`

---

## 15. 刻意延期（非当前决策）

以下尚未纳入 MVP，变更时须新增章节并更新变更日志：

- 任务进度实时推送（WebSocket / polling）
- 多文件批量上传

---
