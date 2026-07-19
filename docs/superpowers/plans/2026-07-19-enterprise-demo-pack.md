# Enterprise Demo Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付最小企业级 Demo 包：证据快照落库、Executive Brief、Issue 筛选/展开证据链、报告导出（下载/复制/打印）。

**Architecture:** 无新表。persist 时把关联 `AuditRecord` 快照写入 `metadata.evidence`；Brief 由纯函数从任务结果派生；Dashboard/报告页用 client 组件做筛选、展开与导出。沿用现有 Fintech Panel 体系。

**Tech Stack:** Next.js 15 App Router、TypeScript、Supabase、现有 `server/report.ts` / `audit-repository.ts`、tsx 单测。

**Spec:** [`docs/superpowers/specs/2026-07-19-enterprise-demo-pack-design.md`](../specs/2026-07-19-enterprise-demo-pack-design.md)

## Global Constraints

- Demo 优先；不做工单状态机、不建 `audit_records` 表、不做服务端 PDF
- 依赖方向：`app/ → server/ → lib/`；`types/` 无反向依赖
- UI 文案中文；标识符英文
- 业务决策变更须同步 `docs/business-decisions.md` + 变更日志
- 每任务结束跑相关测试；全量结束跑 `npm run lint`、`npm run typecheck`、`npm run build`
- 用户未要求时不 git commit

---

## File Map

| 文件 | 动作 | 职责 |
|------|------|------|
| `types/audit.ts` | Modify | 增加 `EvidenceRow` 类型（可选导出） |
| `server/evidence.ts` | Create | `buildEvidenceSnapshot` 纯函数 |
| `server/evidence.test.ts` | Create | 证据快照单测 |
| `server/audit-repository.ts` | Modify | persist 时附加 evidence |
| `server/brief.ts` | Create | `buildExecutiveBrief` 视图模型 |
| `server/brief.test.ts` | Create | Brief 单测 |
| `server/report.ts` | Modify | 发现项附带证据 Markdown 表 |
| `server/report.test.ts` | Modify | 覆盖证据表格输出 |
| `components/ExecutiveBrief.tsx` | Create | Brief UI |
| `components/IssueWorkbench.tsx` | Create | 筛选 + 展开（替代 Dashboard 上的 IssueTable） |
| `components/ReportActions.tsx` | Create | 下载 / 复制 / 打印 |
| `app/dashboard/page.tsx` | Modify | 接入 Brief + IssueWorkbench |
| `app/report/[id]/page.tsx` | Modify | 接入 ReportActions |
| `docs/business-decisions.md` | Modify | evidence / Brief / 导出决策 |
| `todo.md` | Modify | 追加 Phase 10 或勾选增强项 |

---

### Task 1: Evidence snapshot pure function + persist

**Files:**
- Create: `server/evidence.ts`
- Create: `server/evidence.test.ts`
- Modify: `types/audit.ts`（导出 `EvidenceRow`）
- Modify: `server/audit-repository.ts`

**Interfaces:**
- Produces:
  ```ts
  export type EvidenceRow = {
    date: string;
    type: "income" | "expense";
    amount: number;
    vendor: string;
    invoiceId: string;
    department?: string;
    region?: string;
    approvedBy?: string;
  };

  export function collectRecordIndices(
    item: { recordIndex?: number; metadata?: Record<string, unknown> },
  ): number[];

  export function buildEvidenceSnapshot(
    records: AuditRecord[],
    item: { recordIndex?: number; metadata?: Record<string, unknown> },
  ): EvidenceRow[];
  ```
- Consumes: `AuditRecord` from `types/audit.ts`

- [ ] **Step 1: Add `EvidenceRow` to `types/audit.ts`**（紧挨 `AuditIssue` 附近）

- [ ] **Step 2: Write failing tests in `server/evidence.test.ts`**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEvidenceSnapshot,
  collectRecordIndices,
} from "@/server/evidence";
import type { AuditRecord } from "@/types/audit";

const records: AuditRecord[] = [
  {
    date: "2025-03-13",
    type: "expense",
    amount: 6000,
    vendor: "华信",
    invoiceId: "INV-0088",
    approvedBy: "王强",
  },
  {
    date: "2025-03-14",
    type: "expense",
    amount: 6200,
    vendor: "华信",
    invoiceId: "INV-0088",
    approvedBy: "王强",
  },
];

describe("collectRecordIndices", () => {
  it("reads recordIndices from metadata", () => {
    assert.deepEqual(
      collectRecordIndices({ metadata: { recordIndices: [0, 1] } }),
      [0, 1],
    );
  });

  it("reads recordIndex from metadata or top-level", () => {
    assert.deepEqual(
      collectRecordIndices({ metadata: { recordIndex: 1 } }),
      [1],
    );
    assert.deepEqual(collectRecordIndices({ recordIndex: 0 }), [0]);
  });
});

describe("buildEvidenceSnapshot", () => {
  it("maps related records to evidence rows", () => {
    const evidence = buildEvidenceSnapshot(records, {
      metadata: { recordIndices: [0, 1] },
    });
    assert.equal(evidence.length, 2);
    assert.equal(evidence[0]?.invoiceId, "INV-0088");
    assert.equal(evidence[1]?.amount, 6200);
  });

  it("returns empty array when no indices", () => {
    assert.deepEqual(buildEvidenceSnapshot(records, {}), []);
  });
});
```

- [ ] **Step 3: Run test — expect fail**

```bash
npx tsx --test server/evidence.test.ts
```

- [ ] **Step 4: Implement `server/evidence.ts`**

```ts
import type { AuditRecord, EvidenceRow } from "@/types/audit";

export function collectRecordIndices(
  item: { recordIndex?: number; metadata?: Record<string, unknown> },
): number[] {
  const indices = new Set<number>();
  if (typeof item.recordIndex === "number") indices.add(item.recordIndex);

  const meta = item.metadata ?? {};
  if (typeof meta.recordIndex === "number") indices.add(meta.recordIndex);
  if (Array.isArray(meta.recordIndices)) {
    for (const v of meta.recordIndices) {
      if (typeof v === "number") indices.add(v);
    }
  }
  return [...indices].sort((a, b) => a - b);
}

function toEvidenceRow(record: AuditRecord): EvidenceRow {
  return {
    date: record.date,
    type: record.type,
    amount: record.amount,
    vendor: record.vendor,
    invoiceId: record.invoiceId,
    ...(record.department ? { department: record.department } : {}),
    ...(record.region ? { region: record.region } : {}),
    ...(record.approvedBy ? { approvedBy: record.approvedBy } : {}),
  };
}

export function buildEvidenceSnapshot(
  records: AuditRecord[],
  item: { recordIndex?: number; metadata?: Record<string, unknown> },
): EvidenceRow[] {
  return collectRecordIndices(item).flatMap((index) => {
    const record = records[index];
    return record ? [toEvidenceRow(record)] : [];
  });
}
```

- [ ] **Step 5: Wire into `persistAuditResults`**

在 `issueToRow` / `anomalyToIssueRow` 改为接收 `records`，或在 `persistAuditResults` 内 map：

```ts
function withEvidence(
  metadata: Record<string, unknown> | undefined,
  records: AuditRecord[],
  item: { recordIndex?: number; metadata?: Record<string, unknown> },
): Record<string, unknown> {
  const evidence = buildEvidenceSnapshot(records, item);
  return {
    ...metadata,
    ...(evidence.length > 0 ? { evidence } : {}),
  };
}
```

对 `state.issues` / `state.anomalies` 写入时调用；`anomaly` 传入 `{ recordIndex: anomaly.recordIndex, metadata: anomaly.metadata }`。

- [ ] **Step 6: Re-run tests — expect pass**

```bash
npx tsx --test server/evidence.test.ts
```

---

### Task 2: Executive Brief pure function

**Files:**
- Create: `server/brief.ts`
- Create: `server/brief.test.ts`

**Interfaces:**
- Consumes: `AuditIssue`, `getRiskLabel` from `@/lib/theme`, `RISK_SCORE_WEIGHTS`
- Produces:
  ```ts
  export type ExecutiveBriefModel = {
    score: number | null;
    tierLabel: string;
    recordCount: number;
    issueCount: number;
    highCount: number;
    scoreNarrative: string;
    topActions: Array<{
      type: IssueType;
      severity: IssueSeverity;
      summary: string;
      recommendation?: string;
    }>;
  };

  export function buildExecutiveBrief(input: {
    score: number | null;
    recordCount: number;
    issues: AuditIssue[];
  }): ExecutiveBriefModel;
  ```

- [ ] **Step 1: Write failing tests** — Top3 高风险优先；无问题时 `topActions` 为空且 narrative 为正面文案；评分解读提及主要扣分类型

- [ ] **Step 2: Implement `buildExecutiveBrief`**
  - 排序：`high` > `medium` > `low`，同级保持原序
  - Top3：取前 3 条；`summary` = `issue.reason`；`recommendation` 来自 metadata
  - `scoreNarrative`：根据类型计数拼一句（如「扣分主要来自重复发票与审批缺失」）；0 问题则「未发现显著风险信号」
  - `recordCount`：调用方传入（Dashboard 无 records 时用 issues 无法知记录数——**决策**：Brief 的 `recordCount` 从报告副标题解析或任务侧暂不展示精确值）

**记录数来源（锁定）：**  
Dashboard 无 `records`。Brief 展示「问题数 / 高风险数」即可；若报告 content 有 `分析记录 N 条`，可选解析，**YAGNI：Brief 不强制显示记录数**，字段 `recordCount` 允许为 `0` 且 UI 在 `0` 时隐藏「记录数」行。后续若 API 回传 `recordCount` 再接。

更干净的做法：在 `persistAuditResults` 把 `recordCount` 写入 task——但 task 表无此列。**本计划：Brief UI 显示问题数与高风险数；不显示记录数（或显示「—」）。** `ExecutiveBriefModel.recordCount` 可选，Dashboard 传 `0`。

- [ ] **Step 3: Run `npx tsx --test server/brief.test.ts` — pass**

---

### Task 3: Report findings include evidence table

**Files:**
- Modify: `server/report.ts`（`formatFindingLine` / `buildFindingsSection`）
- Modify: `server/report.test.ts`

**Interfaces:**
- Consumes: `EvidenceRow` from metadata
- Produces: Markdown 发现项中附加：

```markdown
   - 关联凭证：
     | 日期 | 类型 | 金额 | 供应商 | 发票号 | 审批人 |
     | --- | --- | --- | --- | --- | --- |
     | ... | ... | ... | ... | ... | ... |
```

- [ ] **Step 1: Add test** — issue 带 `metadata.evidence` 时 findings 含「关联凭证」与发票号

- [ ] **Step 2: Implement helper `formatEvidenceMarkdown(evidence: EvidenceRow[]): string`** 并挂到 `formatFindingLine`

- [ ] **Step 3: Run `npm run test` 相关 — `npx tsx --test server/report.test.ts`**

---

### Task 4: `ExecutiveBrief` UI + Dashboard wire-up

**Files:**
- Create: `components/ExecutiveBrief.tsx`
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `ExecutiveBriefModel` from `buildExecutiveBrief`

- [ ] **Step 1: Create `ExecutiveBrief`** — Panel：风险结论、覆盖范围（问题数/高风险）、Top3 列表、评分解读；无 `model` 时不渲染

- [ ] **Step 2: In Dashboard**，当 `bundle` 存在时：

```ts
const brief = buildExecutiveBrief({
  score: bundle.task.score,
  recordCount: 0,
  issues: bundle.issues,
});
```

放在 KPI 卡片下方、风险分布图上方（或 KPI 与图表之间，按 spec 在任务列表之后）。

- [ ] **Step 3: Manual check** — `npm run dev`，打开已有 completed 任务，应见 Brief（旧任务无 evidence 不影响 Brief）

---

### Task 5: `IssueWorkbench`（筛选 + 展开证据）

**Files:**
- Create: `components/IssueWorkbench.tsx`（`"use client"`）
- Modify: `app/dashboard/page.tsx` — 用 `IssueWorkbench` 替换详情区 `IssueTable`
- Keep: `components/IssueTable.tsx` 供报告页简单列表，或报告页也改用 Workbench（**建议报告页继续用 IssueTable 简化版；Workbench 仅 Dashboard**）

**Interfaces:**
- Props: `{ issues: AuditIssue[] }`
- Client state: `severityFilter`, `typeFilter`, `llmOnly`, `expandedId`

- [ ] **Step 1: Implement filters** — 全部 / 高 / 中 / 低；类型下拉；「仅 AI 解释」开关

- [ ] **Step 2: Sort** — high → medium → low

- [ ] **Step 3: Expand row** — 显示证据表（列：日期、类型、金额、供应商、发票号、审批人）；无 evidence 显示「无关联明细快照」；展示 ruleReference / recommendation

- [ ] **Step 4: Wire Dashboard** — `<IssueWorkbench issues={issues} />`

- [ ] **Step 5: Manual** — 重新上传 demo CSV，展开重复发票应见两行 INV-2025-0088

---

### Task 6: `ReportActions`（下载 / 复制 / 打印）

**Files:**
- Create: `components/ReportActions.tsx`（`"use client"`）
- Modify: `app/report/[id]/page.tsx`
- Modify: 全局或报告页样式（打印时隐藏 nav / actions）— 可用 `print:hidden` Tailwind class

**Interfaces:**
- Props: `{ content: string; taskId: string; fileName?: string }`

- [ ] **Step 1: Download** — Blob `text/markdown`，文件名 `audit-report-{taskId.slice(0,8)}.md`

- [ ] **Step 2: Copy** — `navigator.clipboard.writeText(content)` + 2s「已复制」

- [ ] **Step 3: Print** — `window.print()`；给 layout nav / ReportActions 加 `print:hidden`

- [ ] **Step 4: Place above `ReportViewer` on report page when `content` 非空

---

### Task 7: Docs + final verification

**Files:**
- Modify: `docs/business-decisions.md`（§6/§7 + 变更日志）
- Modify: `docs/superpowers/specs/2026-07-19-enterprise-demo-pack-design.md` 验收清单勾选（实现后）
- Modify: `todo.md` — 增加 Phase 10 企业 Demo 包条目并勾选

- [ ] **Step 1: Update business-decisions** — `metadata.evidence`；Brief 规则；报告导出（客户端）

- [ ] **Step 2: Run full gate**

```bash
npx tsx --test server/evidence.test.ts server/brief.test.ts server/report.test.ts
npm run lint
npm run typecheck
npm run build
```

- [ ] **Step 3: Demo path smoke** — 上传 `fixtures/demo-financial-audit.csv` → Brief Top3 → 展开证据 → 报告导出

- [ ] **Step 4: Ask user whether to commit**（默认不 commit）

---

## Execution Notes

- 旧任务无 `evidence`：UI 降级，不报错
- Brief / 证据 **不** 新增 LLM 调用
- `IssueTable` 可保留给报告页；避免一次改两处交互复杂度
- 若 `persist` 改完后需验证 evidence：必须 **重新上传** 新任务
