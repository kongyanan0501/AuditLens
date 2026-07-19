# AuditLens — 最小企业级 Demo 包设计

> 状态：已通过（2026-07-19）  
> 日期：2026-07-19  
> 范围：Demo / 比赛观感优先 · 约 1–2 天交付深度  
> 关联：`todo.md` Phase 8/9 已完成基础上的产品增强

---

## 1. 背景与目标

### 1.1 现状

AuditLens 已打通：

```text
上传 → 规则/异常 → 评分 → RAG 解释 → 结构化报告 → Dashboard/报告页展示
```

具备任务历史、KPI、风险分布、Issue 列表与四章报告，但仍偏「扫描器 Demo」，缺少企业内审工作台的关键叙事：管理层摘要、证据链、筛选复核、可带走的报告。

### 1.2 目标用户（本轮）

**比赛评委 / Demo 观众**，不是真实工单用户。成功标准是 2 分钟内走完企业感路径，而不是上线完整整改流程。

### 1.3 成功判据

1. 上传 `fixtures/demo-financial-audit.csv`
2. Dashboard 一眼看到评分、高风险数、优先整改 Top3
3. 展开一条高风险 Issue，看到关联明细凭证
4. 打开报告页 → 下载 Markdown / 复制 / 打印

### 1.4 非目标（本轮明确不做）

- 真实工单状态（已确认 / 误报 / 整改中）
- 多租户 / 组织架构
- 规则引擎大规模扩容
- 服务端 PDF 生成
- 新建 `audit_records` 大表

---

## 2. 方案选择

采用 **方案 2：工作台 + 证据链 + Executive Brief + 导出**。

| 模块 | 价值 |
|------|------|
| 审计工作台 | 任务切换 + 筛选，像「在审项目」 |
| 证据链 | 证明不是空话，贴审计痛点 |
| Executive Brief | 管理层叙事，Demo 开场强 |
| 报告导出 | 可带走的交付物感 |

---

## 3. 信息架构

```text
上传 CSV
  → Dashboard 工作台（任务历史 + Brief + 筛选 Issue + 证据展开）
  → 报告页（四章结构 + 导出/打印）
```

| 页面 | 职责 |
|------|------|
| `/upload` | 入口；成功跳转 `/dashboard?taskId=` |
| `/dashboard` | 工作台：任务列表、KPI、Brief、Issue 筛选与证据展开 |
| `/report/[id]` | 正式报告：章节渲染 + 下载/复制/打印 |

现有「最近任务」列表与 KPI 卡片保留，在其上增加 Brief 与 Issue 工作台增强。

---

## 4. 数据与报告结构

### 4.1 证据快照（无 migration）

**问题**：`records` 不落库，刷新后无法靠 `recordIndices` 还原明细。

**决策**：在 `persistAuditResults`（或等价路径）写入 `audit_issues` 时，为每条 issue/anomaly 组装：

```ts
metadata.evidence?: Array<{
  date: string;
  type: "income" | "expense";
  amount: number;
  vendor: string;
  invoiceId: string;
  department?: string;
  region?: string;
  approvedBy?: string;
}>
```

索引来源：已有 `metadata.recordIndex` / `metadata.recordIndices` / anomaly.`recordIndex`，对照流水线 `state.records`。

旧任务无 `evidence` 时，UI 显示「无关联明细快照」。

### 4.2 Executive Brief（不另存表）

由任务结果纯函数计算（可抽离自 / 复用 `server/report.ts`）：

| 区块 | 内容 |
|------|------|
| 风险结论 | 评分 + 档位文案 |
| 覆盖范围 | 记录数、问题数、高风险数 |
| 优先整改 Top3 | 高风险优先；摘要 + 建议（有则展示） |
| 评分解读 | 一句话说明主要扣分来源 |

无选中任务时不渲染 Brief。

### 4.3 正式报告

保持现有四章：

1. 执行摘要  
2. 发现项  
3. 风险分析  
4. 整改建议  

增强：发现项中对含 `evidence` 的条目附加关联凭证 Markdown 小节表。导出内容 = `audit_reports.content`。

### 4.4 文档同步

同一提交内更新 `docs/business-decisions.md`：

- `metadata.evidence` 语义  
- Brief 组成规则  
- 导出能力说明  

---

## 5. UI 交互

### 5.1 Dashboard 布局

```text
最近任务（已有）
↓
Executive Brief（新增）
↓
风险分布图 | Issue 工作台（筛选 + 可展开证据）
```

### 5.2 Issue 工作台

| 交互 | 行为 |
|------|------|
| 排序 | 高风险优先 |
| 筛选 | 严重程度 / 类型 / 仅 AI 解释（client state） |
| 展开行 | 证据表 + 政策依据 + 整改建议 |
| 徽章 | 「AI 解释」；高风险危险色 |

### 5.3 报告页操作

| 操作 | 行为 |
|------|------|
| 下载 Markdown | Blob → `audit-report-{短码}.md` |
| 复制全文 | clipboard + 短暂反馈 |
| 打印 | `window.print` + 打印样式隐藏导航/按钮 |

### 5.4 组件拆分

| 组件 / 模块 | 职责 |
|-------------|------|
| `ExecutiveBrief` | Brief 展示 |
| `IssueWorkbench` 或增强 `IssueTable` | 筛选 + 展开 |
| `ReportActions` | 下载 / 复制 / 打印 |
| `buildEvidenceSnapshot` | 纯函数：records + issue → evidence[] |
| `buildExecutiveBrief` | 纯函数：bundle → Brief 视图模型 |

视觉：沿用现有 Fintech Panel / 主色，不重做整站皮肤。

---

## 6. 实现边界与依赖方向

```text
app/ → server/ → lib/
types/ ← 所有层
```

- 证据组装在 `server/`（persist 或 repository）
- Brief 视图模型可在 `server/` 纯函数，由 RSC 调用
- 筛选/展开/导出为 client 交互组件
- 禁止 client 直连 LLM / Pinecone

---

## 7. 验收清单

- [x] 新上传任务的高风险 Issue 含 `metadata.evidence`（有关联行时）
- [x] Dashboard 展示 Executive Brief（含 Top3）
- [x] Issue 可按严重程度/类型/AI 解释筛选
- [x] 展开 Issue 可见证据表
- [x] 报告页可下载 md、复制、打印
- [x] 旧任务无 evidence 时优雅降级
- [x] `npm run lint` / `typecheck` / `build` 通过
- [x] `docs/business-decisions.md` 已更新

---

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 旧任务无证据 | UI 降级文案，不报错 |
| metadata 体积变大 | 仅写入关联行，不做全表快照 |
| Brief 与报告文案重复 | Brief 偏管理层摘要；报告偏完整底稿 |
| Demo 超时（LLM） | Brief/证据不依赖额外 LLM 调用 |

---

## 9. 审阅记录

| 日期 | 结论 |
|------|------|
| 2026-07-19 | 信息架构 / 数据与报告 / UI 三节口头同意；spec 通过 |
