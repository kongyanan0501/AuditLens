# AuditLens — Phase 11 企业内可用设计

> 状态：已通过（2026-07-19）  
> 日期：2026-07-19  
> 范围：企业内落地（不含平台化）  
> 关联：`todo.md` Phase 11 · 前置 [企业级 Demo 包](./2026-07-19-enterprise-demo-pack-design.md)

---

## 1. 背景与目标

### 1.1 现状

Phase 10 已交付：证据快照、Executive Brief、IssueWorkbench 筛选/展开、报告客户端导出。仍缺：

- 示意知识库（非真制度条款形态）
- 规则阈值写死在代码常量
- Issue 无工单状态 / 分派 / audit trail
- 权限仅「任务所有者」隔离，无审计 vs 业务角色
- 导出缺任务号、操作人、规则版本等底稿要素

### 1.2 目标用户

**企业内部审计**（主）与被分派整改的**业务经办**（辅）。成功标准是真实/脱敏流水可跑通，结果可跟进、可交代。

### 1.3 成功判据

1. 上传流水后，高风险项带规则 ID、阈值快照、证据行
2. 审计可将项确认为风险 / 标为误报，并分派整改
3. 业务仅见分派给自己的项，可关闭整改
4. RAG 引用形如《制度名》+ 条款号
5. 导出报告含任务号、时间戳、操作人、本任务规则版本
6. 审计可在页面修改阈值（必填备注），变更可追溯；只影响之后新任务

### 1.4 非目标（明确不做）

- 多法人 / 多账套平台
- GRC 对接、等保整包、私有化部署包
- 同时接多个外部系统（属 Phase 12）
- 完整用户管理 UI、企微/邮件通知、SLA
- 服务端 PDF
- 制度文件上传解析 UI

### 1.5 原则

- **规则判风险，LLM 只解释**
- 先闭环，再谈更聪明
- 最小 diff；依赖方向 `app/ → server/ → lib/`

---

## 2. 方案选择

采用 **路径 1：垂直切片 + 规范化表 + 最小管理面 B**。

| 决策点 | 选择 |
|--------|------|
| 角色与分派 | `profiles` + `assignee_id` + RLS |
| 规则阈值 | `rule_configs` + `rule_config_versions` |
| 知识库 | 示例本公司制度种子 + `policyName`/`clauseId` |
| 管理面 | IssueWorkbench 闭环 + `/settings/rules` 配置页（仅审计） |

不采用：metadata 塞工单状态（RLS/追溯弱）、纯 SQL 改阈值（落地摩擦大）。

---

## 3. 数据模型与权限

### 3.1 新表

**`profiles`**

| 列 | 类型 | 说明 |
|----|------|------|
| `user_id` | uuid PK → `auth.users` | |
| `role` | text | `auditor` \| `business` |
| `display_name` | text nullable | |
| `created_at` / `updated_at` | timestamptz | |

- 注册触发器：新用户默认 `role = auditor`（兼容现有单用户 Demo）
- 业务账号用 SQL/脚本改 role，本 Phase 无角色管理页

**`rule_configs`**

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | uuid PK | |
| `scope` | text | 默认 `default`；预留事业部 |
| `thresholds` | jsonb | 见 §4 |
| `version` | int | 单调递增（按 scope） |
| `is_active` | boolean | 每 scope 仅一条 active |
| `updated_by` | uuid → auth.users | |
| `change_note` | text | 创建时备注 |
| `created_at` / `updated_at` | timestamptz | |

**`rule_config_versions`**

归档每次被替换的配置快照：`config_id`、`version`、`thresholds`、`updated_by`、`change_note`、`archived_at`。

**`issue_events`**

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | uuid PK | |
| `issue_id` | uuid → audit_issues | |
| `actor_id` | uuid → auth.users | |
| `from_status` | text nullable | |
| `to_status` | text | |
| `note` | text nullable | |
| `created_at` | timestamptz | |

### 3.2 扩展现有表

**`audit_issues`**

| 列 | 说明 |
|----|------|
| `workflow_status` | `pending_review` \| `confirmed` \| `false_positive` \| `remediating` \| `closed`；默认 `pending_review` |
| `assignee_id` | uuid nullable → auth.users |
| `rule_id` | text nullable |
| `rule_version` | int nullable |

既有 `metadata` 继续存：`evidence`、`thresholdSnapshot`、`originalReason`、`recommendation`、`ruleReference`、`llmExplained` 等。

**`audit_tasks`**

| 列 | 说明 |
|----|------|
| `rule_config_version` | int nullable；任务运行时写入所用配置版本 |

**`knowledge_base`**

| 列 | 说明 |
|----|------|
| `policy_name` | text nullable |
| `clause_id` | text nullable |

### 3.3 RLS

| 主体 | 策略要点 |
|------|----------|
| `auditor` | 可读全部 tasks / issues / reports；可更新 issue 工单字段；可写 rule_configs |
| `business` | issues：仅 `assignee_id = auth.uid()` 可读；可更新限于约定流转（见 §5）；不可读未分派项；不可写 rule_configs |
| `rule_configs` | authenticated 可读 active；仅 auditor 插入/更新（经服务端） |
| `issue_events` | 可读范围随所属 issue；插入由服务端以当前用户写入 |
| `knowledge_base` | 保持 authenticated 可读；写入走 seed/service |
| `profiles` | 用户可读自己；auditor 可读全部；禁止 client 自提权改 role（role 变更走 SQL/service） |

任务与列表可见性：

- `auditor`：Dashboard 可见全部任务与全部 issues
- `business`：**不展示全量任务历史**；Dashboard 主列表为「我的待办」issues（`assignee_id = auth.uid()`），避免泄露未分派任务元数据

---

## 4. 规则配置与命中语义

### 4.1 默认 thresholds

```json
{
  "amountMultiplier": 5,
  "vendorShareThreshold": 0.5,
  "mandatoryReviewAmount": 50000
}
```

| 规则 ID | 行为 |
|---------|------|
| `RULE_DUPLICATE_INVOICE` | 发票号重复（无数值阈值） |
| `RULE_MISSING_APPROVAL` | 支出缺审批 |
| `RULE_AMOUNT_ANOMALY` | 金额 > 均值 × `amountMultiplier` |
| `RULE_VENDOR_CONCENTRATION` | 单一供应商支出占比 > `vendorShareThreshold` |
| `RULE_MANDATORY_REVIEW` | 单笔支出 ≥ `mandatoryReviewAmount`（新增） |

### 4.2 配置页 `/settings/rules`

- 仅 `auditor`；`business` 重定向 `/dashboard`
- 编辑三个数值 + **必填变更备注** → 保存
- 保存流程：归档当前 active → 插入新 version（`version++`，`is_active=true`）
- 展示：当前版本、最近变更列表（人 / 时间 / 备注 / 阈值摘要）

### 4.3 运行时

1. Graph 启动加载 `scope=default` 且 `is_active` 的配置；写入 `audit_tasks.rule_config_version`
2. `runRuleCheck` / `runAnomalyDetection` 接受 `RuleThresholds`；模块常量仅 fallback
3. 每条 issue：`rule_id`、`rule_version`；`metadata.thresholdSnapshot`；`reason` 含规则 ID 与阈值
4. **配置变更只影响之后新跑任务**；已落库 issue 不回溯

原则：规则/异常判风险；LLM 不改判定结果。

---

## 5. Issue 工单流转

### 5.1 状态机

```text
pending_review
  → confirmed | false_positive
confirmed → remediating   （仅通过 action=assign，且必须带 assigneeId）
remediating → closed
false_positive → closed
非终态 → pending_review   （仅审计 action=reopen，须备注）
```

流转为**两步**：先 `confirm`，再 `assign`（不可在 `pending_review` 上直接 assign）。  
`assign` 在已是 `remediating` 时可再次调用以**改派**（仍须 `assigneeId`）。

### 5.2 角色操作

| 角色 | 允许 |
|------|------|
| `auditor` | confirm / false_positive / assign / close / reopen；改派；备注 |
| `business` | 仅己项：`remediating → closed`（可附备注）；只读证据与解释 |

### 5.3 API

`PATCH /api/issues/[id]`

```ts
{
  action: "confirm" | "false_positive" | "assign" | "close" | "reopen";
  note?: string;       // reopen 必填；其余可选
  assigneeId?: string; // assign 必填（uuid）
}
```

- 服务端校验角色 + 合法迁移；非法迁移返回 409
- 写 `issue_events`，更新 `workflow_status` / `assignee_id`
- 认证与授权在 route handler 内完成（不单靠 middleware）
- 分派人须为已有 `profiles` 行的用户（建议 `role=business`，亦允许分派给 auditor 以便 Demo）

### 5.4 IssueWorkbench

- 展示：工作流状态、分派人、规则 ID/版本
- 展开：证据链 + 操作按钮（随角色/状态）+ 备注 + events 时间线
- 筛选：工作流状态；「分派给我」（business 默认开）

新建 issue：`workflow_status = pending_review`，`assignee_id = null`。

本 Phase 不做通知 / SLA（Phase 12）。

---

## 6. 真制度知识库与底稿导出

### 6.1 知识库

- 替换示意 `KNOWLEDGE_SEED_ENTRIES` 为示例本公司制度（报销 / 授权 / 采购，各 ≥2 条）
- 字段：`policy_name`、`clause_id`、`category`、`content`
- Seed：写 `knowledge_base` + Pinecone metadata（`policyName`、`clauseId`、`category`）
- RAG `ruleReference` 优先：`《{policyName}》{clauseId}`；无 metadata 时降级现有行为
- 换真制度：改种子文件后重跑 seed（无上传 UI）

### 6.2 底稿要素

- Issue metadata 固化证据、阈值快照、规则版本、`originalReason`、AI 解释原文（enrich 后的 `reason` + recommendation）
- 报告页眉 / 导出：任务号、生成时间、操作人（导出用户）、本任务 `rule_config_version`
- `ReportActions` 下载/复制/打印均带页眉

---

## 7. 信息架构与文件地图（预览）

```text
登录
  → Dashboard（Brief + 工作台；business 偏「我的待办」）
  → /settings/rules（仅审计）
  → 报告导出（底稿页眉）
```

主要改动面（实施计划细化）：

| 区域 | 文件（预期） |
|------|----------------|
| Migration + schema | `supabase/migrations/*_phase11.sql`, `supabase/schema.md`, `types/database.ts` |
| 领域类型 | `types/audit.ts` |
| 规则引擎 | `server/rules.ts`, `server/anomaly.ts`, `server/rule-config.ts` |
| 工单 | `server/issue-workflow.ts`, `app/api/issues/[id]/route.ts` |
| 知识库 | `server/rag.ts`, `scripts/seed-knowledge-base.ts` |
| UI | `components/IssueWorkbench.tsx`, `app/settings/rules/page.tsx`, `components/ReportActions.tsx` |
| 文档 | `docs/business-decisions.md`, `todo.md` |

---

## 8. 测试与验收

- 单元：状态机合法/非法迁移；thresholds 注入后命中；ruleReference 拼装
- 手动：双角色账号（auditor / business）走通确认→分派→关闭；改阈值后新任务用新版本；导出含页眉
- `npm run lint` / `typecheck` / `build` 全绿
- 同步 `docs/business-decisions.md` 变更日志与 `supabase/schema.md`

---

## 9. 对话中已确认的决策摘要

1. 角色：profiles + assignee + RLS（非 metadata）
2. 配置：rule_configs 表 + 版本表
3. 知识库：示例制度种子 + policy/clause metadata
4. 管理面：**B** — 审计可在 `/settings/rules` 手改阈值（必填备注）
5. 架构：垂直切片一次 migration

---

## 10. 落地差异（相对初版设计）

| 设计项 | 落地 |
|--------|------|
| 表名 `rule_configs` / `issue_events` | `audit_rule_configs` / `audit_issue_events` |
| 独立 `rule_config_versions` 表 | 同表多行 + `is_active`；旧行保留作版本历史 |
| `RULE_MANDATORY_REVIEW` 独立 issue 类型 | 并入 `R-APR-001`：`approvalRequiredMinAmount`（0=全部支出须审批） |
| API `action` 枚举 | `PATCH` body 使用 `toStatus` + 可选 `assigneeId` |
| 配置入口 | `/settings/rules` 与 `/me`（审计可见表单） |
| 角色切换 | 默认禁止自提权；`ALLOW_DEMO_ROLE_SWITCH=true` 时允许演示切换 |

---

## 变更日志（本文档）

| 日期 | 说明 |
|------|------|
| 2026-07-19 | 补充落地差异；任务 `rule_config_version`、变更备注必填、业务仅 remediating→closed |
| 2026-07-19 | 初版：§1–§4 设计对话批准后落盘 |
