# AuditLens — 线上整改验收设计

> 状态：已通过（2026-07-19）  
> 日期：2026-07-19  
> 范围：Issue 工单「提交整改 → 审计验收」闭环（附件存证，不自动重跑规则）  
> 关联：Phase 11 企业内可用 · `docs/business-decisions.md` §角色/工单

---

## 1. 背景与目标

### 1.1 现状

Phase 11 已支持：审计确认/分派、业务仅见分派项、业务可将 `remediating → closed`。  
缺口：无结构化整改说明、无证明附件、业务可直关单，不符合真实审计「业务整改 → 审计验收」闭环。

### 1.2 目标

业务在系统内提交整改（措施 + 完成说明 + 至少一份证明/修正文件），状态进入「待验收」；审计查看材料后通过关闭或驳回重开整改。修正版流水**仅存证**，本 Phase **不**自动重跑审计规则。

### 1.3 成功判据

1. 业务在「整改中」可提交验收；缺说明或缺附件时无法提交  
2. 业务**不能**再直接 `remediating → closed`  
3. 审计可对「待验收」通过（→ 已关闭）或驳回（→ 整改中，须填原因）  
4. 附件可列表与签名下载；RLS/鉴权不泄露未分派问题的材料  
5. 轨迹写入 `audit_issue_events`

### 1.4 非目标

- 在线表格编辑原流水（方案 A/C）  
- 修正文件自动重跑规则并消项（延期）  
- 独立多版本 `issue_remediations` 表（延期；本 Phase 用 issue 快照列 + events + attachments）  
- 企微/邮件通知、SLA  
- 公开 Storage bucket

---

## 2. 方案选择

采用 **方案 1：现有工单扩展 + 新状态 `pending_verification` + Storage 附件表**。

| 决策点 | 选择 |
|--------|------|
| 关单权 | 必须审计验收通过才关闭；驳回回 `remediating` |
| 证明材料 | 文字必填 + 至少 1 附件（evidence 或 corrected_file） |
| 修正文件 | 只存证，不重跑（后续可加） |
| UI 落点 | 扩展 `IssueWorkbench`，不新开独立应用页 |

不采用：独立 remediation 版本表（第一版过重）；仅文字无附件（不满足需求）。

---

## 3. 状态机与权限

### 3.1 状态

新增 `pending_verification`（中文：**待验收**）。

完整相关路径：

```text
pending_review → confirmed | false_positive
confirmed → remediating | closed
remediating → pending_verification     （仅业务，须校验提交条件）
pending_verification → closed          （仅审计，通过）
pending_verification → remediating     （仅审计，驳回；须备注）
false_positive → closed | pending_review
closed → pending_review                （重新打开，须备注；仅审计）
```

从 `remediating` **移除** 业务直达 `closed`。审计在 `remediating` 上仍可保留改派等既有能力（`confirmed` / 改派）；审计**不应**从 `remediating` 直接 `closed` 绕过验收（与业务同一约束：关闭须经 `pending_verification`，或误报路径除外）。

> 明确：正常风险项关单路径为 `… → remediating → pending_verification → closed`。误报 `false_positive → closed` 不变。

### 3.2 角色

| 角色 | 允许 |
|------|------|
| business | 仅操作 `assignee_id = self`；仅 `remediating → pending_verification` |
| auditor | `pending_verification → closed` / `→ remediating`；既有确认/分派/误报等 |
| business | 不可上传/规则配置（沿用 Phase 11） |

### 3.3 提交待验收校验

同时满足：

1. `remediation_action`、`remediation_result` 均非空，各自 trim 后长度 ≥ 10  
2. 该 issue 至少存在 1 条 `audit_issue_attachments`（任意 kind）  
3. 操作者为当前 `assignee_id`

驳回：`note` 必填（trim 后非空）。通过关闭：`note` 可选。

---

## 4. 数据模型与 Storage

### 4.1 `audit_issues` 新增列

| 列 | 类型 | 说明 |
|----|------|------|
| `remediation_action` | text null | 措施说明 |
| `remediation_result` | text null | 完成说明 |
| `remediation_submitted_at` | timestamptz null | 最近提交时间 |
| `remediation_submitted_by` | uuid null → auth.users | 提交人 |

驳回**不清空**上述字段与附件，便于修改后再次提交。关单后保留作底稿。

`workflow_status` check / 应用枚举增加 `pending_verification`。

### 4.2 表 `audit_issue_attachments`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | uuid PK | |
| `issue_id` | uuid → audit_issues ON DELETE CASCADE | |
| `uploaded_by` | uuid → auth.users | |
| `kind` | text | `evidence` \| `corrected_file` |
| `file_name` | text | 原始文件名 |
| `mime_type` | text | |
| `byte_size` | int | |
| `storage_path` | text | bucket 内路径 |
| `created_at` | timestamptz | default now() |

索引：`(issue_id, created_at)`。

### 4.3 Storage

- Bucket 名：`issue-remediation`（**private**）  
- 对象路径：`{issue_id}/{attachment_id}/{safe_file_name}`  
- 下载：服务端签发短时 signed URL，不暴露公开读  
- 上传鉴权：业务仅当自己为 assignee 且 issue 为 `remediating`；审计可读（列表/下载）与 issue 可见性一致的附件  

### 4.4 事件

继续使用 `audit_issue_events`：提交/通过/驳回均写 from/to + note（提交 note 可为说明摘要）。附件明细以 attachments 表为准。

### 4.5 类型同步

同一提交内更新：`supabase/migrations/*.sql`、`supabase/schema.md`、`types/database.ts`、`types/audit.ts`、`docs/business-decisions.md`（变更日志一行）。

---

## 5. API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/issues/[id]/attachments` | multipart：`file` + `kind`；写 Storage + 行 |
| GET | `/api/issues/[id]/attachments` | 列表；每项含 signed download URL |
| PATCH | `/api/issues/[id]` | 扩展 body：`remediationAction` / `remediationResult`；`toStatus` 含 `pending_verification` |

核心逻辑在 `server/issue-workflow.ts`（与附件服务 `server/issue-attachments.ts`）：非法流转 409；缺说明/附件 400；无权 400/403。

文件限制（第一版）：

- 允许：`image/png`、`image/jpeg`、`image/webp`、`application/pdf`、以及 xlsx/xls/csv 对应 MIME  
- 单文件 ≤ 10MB；单 issue 附件总数建议上限 20（防滥用）

---

## 6. UI

扩展 `components/IssueWorkbench.tsx`（中文文案）：

**业务 · 整改中**

- 表单：措施说明、完成说明  
- 上传控件（可多文件；标注 evidence / 修正流水）  
- 已上传列表；第一版允许删除：仅 `uploaded_by = self` 且 issue 仍为 `remediating` 的附件（已进入待验收后不可删）  
- 按钮「提交验收」

**审计 · 待验收**

- 只读展示措施/完成说明与附件（下载）  
- 「通过并关闭」「驳回」（驳回弹出/必填原因）

Dashboard 筛选增加「待验收」。业务空状态文案保持「等待分派」；有待办时状态徽章显示「待验收」。

---

## 7. 错误处理与测试

| 场景 | 期望 |
|------|------|
| 业务无附件提交 | 400，中文提示 |
| 业务尝试 closed | 拒绝 |
| 审计通过 / 驳回 | 状态与事件正确 |
| 非 assignee 上传 | 拒绝 |
| Storage/DB 上传失败 | 不推进 workflow |

单测重点：`server/issue-workflow` 新流转与角色约束；附件校验「至少 1」。

---

## 8. 实施边界

依赖方向不变：`app/ → server/ → lib/`。  
LLM/向量不涉及。  
完成后：`npm run lint`、`npm run build`、相关单元测试。

---

## 变更日志（本文档）

| 日期 | 说明 |
|------|------|
| 2026-07-19 | 初稿：方案 1 线上整改验收（待验收状态 + 附件存证） |
