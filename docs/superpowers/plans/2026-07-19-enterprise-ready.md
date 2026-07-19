# Phase 11 Enterprise Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 Phase 11 企业内可用：真制度 KB、可配置阈值、Issue 工单闭环、审计/业务角色 RLS、底稿导出元数据。

**Architecture:** Migration 扩展 `profiles` / `audit_rule_configs`（版本行）/ `audit_issue_events` / issue 工单列；规则引擎注入阈值；`PATCH /api/issues/[id]` 状态机；`/me` 承载规则配置与角色演示；导出附任务号/操作人/规则版本。

**Tech Stack:** Next.js 15、TypeScript、Supabase RLS、现有 LangGraph 流水线、tsx 单测。

**Spec:** [`docs/superpowers/specs/2026-07-19-enterprise-ready-design.md`](../specs/2026-07-19-enterprise-ready-design.md)

## Global Constraints

- 依赖方向：`app/ → server/ → lib/`；`types/` 无反向依赖
- UI 文案中文；标识符英文
- 规则判风险，LLM 只解释
- 业务决策变更同步 `docs/business-decisions.md`；schema 变更同步 `supabase/schema.md` + `types/database.ts`
- 用户未要求时不 git commit
- 不做：多法人、GRC、通知/SLA、制度上传 UI、服务端 PDF

## Spec ↔ Implementation notes

| Spec 名 | 落地名 | 说明 |
|---------|--------|------|
| `rule_configs` + versions 表 | `audit_rule_configs` 多行 `is_active` | 归档=旧行 `is_active=false` |
| `issue_events` | `audit_issue_events` | |
| `/settings/rules` | `/me` 内 `RuleConfigForm` + 可选 `/settings/rules` 别名页 | |
| `RULE_MANDATORY_REVIEW` 独立类型 | `approvalRequiredMinAmount` 门槛并入 `R-APR-001` | 金额≥门槛且缺审批才命中；0=全部支出 |
| action 枚举 API | `toStatus` + optional `assigneeId` | 语义等价 |

---

## File Map

| 文件 | 动作 | 职责 |
|------|------|------|
| `supabase/migrations/20260719000000_phase11_enterprise.sql` | Exists / patch | 加 `audit_tasks.rule_config_version`（若缺） |
| `supabase/schema.md` / `types/database.ts` / `types/audit.ts` | Modify | 同步列 |
| `server/rule-config.ts` | Exists | 读/发布配置 |
| `server/issue-workflow.ts` | Modify | 收紧 business 仅 `remediating→closed`；reopen 须备注 |
| `server/issue-workflow.test.ts` | Create | 状态机单测 |
| `server/audit-repository.ts` / `langgraph` / `api/audit` | Exists / patch | 持久化规则版本到 task |
| `lib/report-export.ts` / `ReportActions` | Modify | 导出含规则版本 |
| `app/api/settings/rules/route.ts` | Modify | `changeNote` 必填 |
| `app/api/profile/route.ts` | Modify | 角色切换需 `ALLOW_DEMO_ROLE_SWITCH=true` |
| `app/settings/rules/page.tsx` | Create | 审计配置页（与 /me 共用表单） |
| `middleware.ts` / `AppShell` | Modify | 保护与导航 |
| `docs/business-decisions.md` / `todo.md` / design spec | Modify | 对齐落地差异 |

---

### Task 1: Task-level rule_config_version + export

**Files:**
- Modify: `supabase/migrations/20260719000000_phase11_enterprise.sql`
- Modify: `supabase/schema.md`, `types/database.ts`, `types/audit.ts`
- Modify: `server/audit-repository.ts`, `app/api/audit/route.ts`（若尚未写入）
- Modify: `lib/report-export.ts`, `components/ReportActions.tsx`, `app/report/[id]/page.tsx`

- [x] **Step 1:** 若 migration 无 `audit_tasks.rule_config_version`，追加 `alter table ... add column if not exists rule_config_version integer;`
- [x] **Step 2:** 类型与 mapper 增加 `ruleConfigVersion`
- [x] **Step 3:** 审计完成后把 active config.version 写入 task
- [x] **Step 4:** `withExportMetadata` 增加可选 `ruleConfigVersion`；ReportActions 传入并展示
- [x] **Step 5:** 跑测试与 typecheck

### Task 2: Workflow hardening + unit tests

**Files:**
- Modify: `server/issue-workflow.ts`
- Create: `server/issue-workflow.test.ts`

- [x] **Step 1:** business 仅允许 `from=remediating` 且 `to=closed`
- [x] **Step 2:** `toStatus=pending_review`（reopen）时 `note` 必填
- [x] **Step 3:** 单测 `allowedTransitions`
- [x] **Step 4:** `tsx --test server/issue-workflow.test.ts`

### Task 3: Config UX + security gates

**Files:**
- Modify: `server/rule-config.ts`, `app/api/settings/rules/route.ts`, `components/RuleConfigForm.tsx`
- Modify: `app/api/profile/route.ts`, `components/RoleSwitcher.tsx`
- Create: `app/settings/rules/page.tsx`
- Modify: `middleware.ts`, `components/AppShell.tsx`

- [x] **Step 1:** `publishRuleConfig` 要求 `changeNote` 非空（trim 后 length≥1）
- [x] **Step 2:** Form 保存前校验备注；按钮 disabled 当备注空
- [x] **Step 3:** PATCH profile role 仅当 `process.env.ALLOW_DEMO_ROLE_SWITCH === "true"`；否则 403；UI 无 flag 时隐藏切换按钮
- [x] **Step 4:** `/settings/rules` 页：auditor 渲染 `RuleConfigForm`，business redirect dashboard
- [x] **Step 5:** middleware 保护 `/settings`；AppShell 导航加「规则配置」

### Task 4: Docs sync + acceptance

**Files:**
- Modify: `docs/superpowers/specs/2026-07-19-enterprise-ready-design.md`（落地差异）
- Modify: `docs/business-decisions.md`（若缺口）
- Modify: `todo.md` 进度总览 Phase 11 → `[x]`

- [x] **Step 1:** Spec 注明表名与必审门槛语义
- [x] **Step 2:** `npm run lint && npm run typecheck && npm run build`
- [x] **Step 3:** 跑相关单测
- [x] **Step 4:** 勾选验收完成

---

## Execution

本计划在既有未提交 Phase 11 代码之上做缺口修补与验收。优先 Inline Execution。
