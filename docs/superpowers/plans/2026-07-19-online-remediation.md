# Online Remediation Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 业务提交结构化整改说明与证明附件进入「待验收」，审计通过后关闭或驳回重开，不再允许业务直关单。

**Architecture:** 扩展现有 `issue-workflow` 状态机（新增 `pending_verification`）；`audit_issues` 存整改快照列；新表 `audit_issue_attachments` + private Storage bucket `issue-remediation`；API 上传/列表/流转；`IssueWorkbench` 按角色展示提交或验收 UI。修正文件只存证，不重跑规则。

**Tech Stack:** Next.js App Router、Supabase Auth/DB/Storage、既有 `server/issue-workflow.ts`、node:test

**Spec:** [`docs/superpowers/specs/2026-07-19-online-remediation-design.md`](../specs/2026-07-19-online-remediation-design.md)

## Global Constraints

- 依赖方向：`app/ → server/ → lib/`；`types/` 不 import 业务代码
- UI 文案中文；标识符英文
- 业务仅 `remediating → pending_verification`；关闭须经审计 `pending_verification → closed`
- 提交待验收：措施/完成说明各 trim ≥ 10，且至少 1 附件
- 单文件 ≤ 10MB；允许 png/jpeg/webp/pdf + xlsx/xls/csv
- DB 变更同一提交同步：migration、`supabase/schema.md`、`types/database.ts`、`types/audit.ts`、`docs/business-decisions.md` 变更日志
- 最小 diff；完成后 `npm run lint` + `npm run build` + 相关测试

## File Structure

| 文件 | 职责 |
|------|------|
| `supabase/migrations/20260719100000_online_remediation.sql` | 状态枚举、issue 列、attachments 表、Storage bucket/policies、RLS |
| `supabase/schema.md` | canonical schema 文档 |
| `types/audit.ts` / `types/database.ts` | `pending_verification`、附件类型、map 函数 |
| `server/issue-workflow.ts` | 流转矩阵与角色/提交校验 |
| `server/issue-attachments.ts` | 上传/列表/删除/签名 URL |
| `app/api/issues/[id]/route.ts` | PATCH 扩展 remediation 字段 |
| `app/api/issues/[id]/attachments/route.ts` | GET/POST/DELETE 附件 |
| `components/IssueWorkbench.tsx` | 提交整改 / 验收 UI |
| `server/issue-workflow.test.ts` | 流转单测 |
| `server/issue-attachments.test.ts` | MIME/大小/至少一份校验（纯函数） |
| `docs/business-decisions.md` | 工单章节 + 变更日志 |
| `docs/supabase-setup.md` | Storage bucket 启用说明（简短） |

---

### Task 1: Types + migration + schema docs

**Files:**
- Create: `supabase/migrations/20260719100000_online_remediation.sql`
- Modify: `types/audit.ts`（`IssueWorkflowStatus`、`ISSUE_WORKFLOW_STATUSES`、附件类型）
- Modify: `types/database.ts`（表类型、`mapIssueRow` 新字段、`mapAttachmentRow`）
- Modify: `supabase/schema.md`
- Modify: `docs/business-decisions.md`（§工单 + 变更日志一行）
- Modify: `docs/supabase-setup.md`（Storage 一小节）

**Interfaces:**
- Produces: `IssueWorkflowStatus` 含 `"pending_verification"`；`IssueAttachmentKind = "evidence" | "corrected_file"`；`AuditIssue` 含 `remediationAction?` 等；DB Row 类型可被 repository/workflow 使用

- [ ] **Step 1: 写 migration**

幂等 SQL 要点：
- `alter` drop/add `audit_issues_workflow_status_check` 加入 `pending_verification`
- `audit_issues` 加四列：`remediation_action`、`remediation_result`、`remediation_submitted_at`、`remediation_submitted_by`
- `create table audit_issue_attachments (...)` + index + RLS（业务：assignee 可读自己 issue 的附件、remediating 时可 insert/delete 自己的；审计：可读可见 issue 的附件——策略与现有 auditor helper 一致，避免递归）
- Storage：`insert into storage.buckets (id, name, public) values ('issue-remediation', 'issue-remediation', false) on conflict do nothing` + storage policies（路径第一段 = issue_id；鉴权尽量简单：authenticated + 服务端用 service role 上传亦可——**推荐服务端 admin 上传**以降低 Storage RLS 复杂度，表 RLS 仍保护元数据）

推荐实现约定（写进 migration 注释）：**文件字节由 API 用 service role 写入 Storage**；客户端不直传 bucket。表 `audit_issue_attachments` 的 SELECT 走用户 supabase client + RLS。

- [ ] **Step 2: 更新 types + schema.md + business-decisions + supabase-setup**

- [ ] **Step 3: 提醒用户在 SQL Editor 执行 migration + `notify pgrst, 'reload schema';`**

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260719100000_online_remediation.sql supabase/schema.md types/audit.ts types/database.ts docs/business-decisions.md docs/supabase-setup.md
git commit -m "$(cat <<'EOF'
Add online remediation schema and types.

Introduce pending_verification, remediation snapshot columns, and issue attachments.
EOF
)"
```

---

### Task 2: Workflow engine (TDD)

**Files:**
- Modify: `server/issue-workflow.ts`
- Modify: `server/issue-workflow.test.ts`
- Modify: `server/audit-queries.ts`（map 新字段到 `AuditIssue`）

**Interfaces:**
- Consumes: `IssueWorkflowStatus` 含 `pending_verification`
- Produces: 更新后的 `TRANSITIONS` / `transitionIssue`；`TransitionIssueInput` 增加可选 `remediationAction?`、`remediationResult?`；提交前调用附件计数（可注入或内部 admin count）

目标流转矩阵：

```ts
pending_review: ["confirmed", "false_positive"],
confirmed: ["remediating", "closed"],
false_positive: ["closed", "pending_review"],
remediating: ["pending_verification", "confirmed"], // 去掉 closed
pending_verification: ["closed", "remediating"],
closed: ["pending_review"],
```

角色规则：
- business：仅 `remediating → pending_verification`；须说明长度；须 `count(attachments) >= 1`；写 remediation 列 + submitted_at/by
- auditor：`pending_verification → closed`；`pending_verification → remediating` 须 note；**禁止** `remediating → closed`
- 驳回不清空 remediation 字段

- [ ] **Step 1: 改失败单测** — 更新 `allowedTransitions("remediating")`；新增 `pending_verification` 用例

- [ ] **Step 2: 跑测确认失败**

```bash
npx tsx --test server/issue-workflow.test.ts
```

- [ ] **Step 3: 改 `TRANSITIONS` + labels + `transitionIssue` 校验与 update 字段**

- [ ] **Step 4: 跑测通过；同步 `audit-queries` map 字段**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
Enforce remediation verification in issue workflow.

Business submits to pending_verification; only auditors can close after review.
EOF
)"
```

---

### Task 3: Attachments server module + API

**Files:**
- Create: `server/issue-attachments.ts`
- Create: `server/issue-attachments.test.ts`（validateMime/size/kind 纯函数）
- Create: `app/api/issues/[id]/attachments/route.ts`
- Modify: `app/api/issues/[id]/route.ts`（PATCH 解析 remediationAction/Result）

**Interfaces:**
- Produces:
  - `validateAttachmentFile(file: { mimeType: string; byteSize: number; fileName: string }, kind: IssueAttachmentKind): { ok: true } | { ok: false; message: string }`
  - `listIssueAttachments(issueId, actor): Promise<AttachmentDTO[]>`（含 signedUrl）
  - `uploadIssueAttachment({ issueId, actorId, role, kind, file }): Promise<AttachmentDTO>`
  - `deleteIssueAttachment({ attachmentId, actorId, role }): Promise<void>`
- Consumes: `createAdminClient`、issue assignee/status 检查（与 workflow 一致）

上传流程：鉴权 → 校验 issue remediating + assignee（业务）→ 校验文件 → insert 行拿 id → storage upload →（失败则删行）

DELETE：仅 uploader + remediating。

- [ ] **Step 1: 纯函数校验单测（先写后实现）**

- [ ] **Step 2: 实现 `server/issue-attachments.ts`**

- [ ] **Step 3: 实现 attachments route GET/POST/DELETE**

- [ ] **Step 4: PATCH route 传入 remediation 字段**

- [ ] **Step 5: 跑 `npx tsx --test server/issue-attachments.test.ts server/issue-workflow.test.ts`**

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
Add issue remediation attachment upload API.

Store evidence in private Supabase Storage with signed downloads.
EOF
)"
```

---

### Task 4: IssueWorkbench UI

**Files:**
- Modify: `components/IssueWorkbench.tsx`

**Interfaces:**
- Consumes: attachments API + PATCH `toStatus: "pending_verification" | "closed" | "remediating"`

行为：
- `workflowLabels.pending_verification = "待验收"`
- business + remediating：措施/完成 textarea、上传、列表、删除、提交验收（先确保有附件再 PATCH）
- auditor + pending_verification：只读说明 + 附件下载链接、通过并关闭、驳回（必填原因）
- business actions 不再出现「关闭」直达 closed
- 筛选下拉含待验收

- [ ] **Step 1: 扩展 labels 与 business/auditor action 矩阵**

- [ ] **Step 2: 实现附件加载/上传/删除 UI**

- [ ] **Step 3: 实现提交验收与审计通过/驳回**

- [ ] **Step 4: 手动冒烟清单（写在 PR/提交说明即可）**
  1. 业务无附件提交 → 被拒  
  2. 有说明+附件 → 待验收  
  3. 审计驳回 → 整改中，说明仍在  
  4. 再提交 → 审计通过 → 已关闭  

- [ ] **Step 5: `npm run lint` && `npm run build`**

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
Add remediation submit and verification UI in IssueWorkbench.

Business uploads evidence; auditors approve or reject pending items.
EOF
)"
```

---

### Task 5: Docs polish + todo

**Files:**
- Modify: `todo.md`（Phase 11 或新小节标记线上整改）
- 确认 `docs/business-decisions.md` 与实现一致

- [ ] **Step 1: 对照 spec 成功判据勾选**

- [ ] **Step 2: Commit docs if needed**

---

## Manual verification (after all tasks)

1. SQL Editor 执行 `20260719100000_online_remediation.sql` + reload schema  
2. 双浏览器配置：审计分派 → 业务上传附件并提交 → 审计验收  
3. 确认 Storage bucket `issue-remediation` 中有对象且非 public  

## Out of scope (do not implement)

- 修正文件自动重跑规则  
- 在线改原流水表格  
- 独立 `issue_remediations` 版本表  
- 通知 / SLA  
