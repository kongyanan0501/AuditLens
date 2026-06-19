
---

# 📄 AuditLens AI — System Design (Final MVP Spec)

---

# 🧭 1. 项目概述

AuditLens AI 是一个面向审计/税务场景的智能风险分析系统，通过 LLM + 规则引擎 + 向量检索，实现：

* 财务数据自动审计
* 风险识别与评分
* 异常检测解释
* 自动生成审计报告

---

# 🧱 2. 技术栈

## 🖥 前端 / 后端一体

```text
Next.js 15 (App Router)
TypeScript
TailwindCSS
shadcn/ui
```

👉 说明：
所有 API route + UI + AI orchestration 均在 Next.js 内完成

---

## 🧠 AI Layer

```text
LangGraph (workflow orchestration)
LangChain (tools / prompt)
OpenAI / DeepSeek / Claude (pluggable)
```

---

## 🧬 RAG（知识库）

```text
Pinecone (free tier)
Embedding: OpenAI text-embedding-3-small
```

---

## 🗄 数据库

```text
Supabase (Postgres + Auth)
```

---

# 🧩 3. 总体架构（关键）

```text
[ Next.js UI ]
      ↓
[ API Routes (Next.js Server) ]
      ↓
[ Audit Orchestrator (LangGraph) ]
      ↓
 ┌──────────────┬────────────────┬───────────────┐
 │ Rule Engine   │ Anomaly Engine │ RAG Engine     │
 │ (deterministic)│ (statistical) │ (Pinecone)     │
 └──────────────┴────────────────┴───────────────┘
      ↓
[ LLM Reasoning Layer ]
      ↓
[ Supabase DB ]
```

---

# 🔐 4. 登录系统（Supabase Auth）

## 4.1 功能

* Email + Password 登录
* Session 管理
* 登录保护 Dashboard
* 用户隔离数据

---

## 4.2 Supabase 配置

```ts
lib/supabase/client.ts
```

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

---

## 4.3 登录流程

```text
Login Page
  ↓
Supabase Auth
  ↓
JWT Session
  ↓
Protected Dashboard
```

---

## 4.4 Auth Hook

```ts
hooks/useAuth.ts
```

```ts
export function useAuth() {
  const user = supabase.auth.getUser();
  return { user };
}
```

---

## 4.5 Route Protection

```ts
middleware.ts
```

```ts
import { NextResponse } from "next/server";

export function middleware(req) {
  const token = req.cookies.get("sb-token");

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}
```

---

# 🧠 5. AI 架构（完全解耦）

---

## 5.1 AI Provider Interface

```ts
interface LLMProvider {
  chat(input: string): Promise<string>;
  embed(input: string): Promise<number[]>;
}
```

---

## 5.2 OpenAI 实现

```ts
class OpenAIProvider implements LLMProvider {
  async chat(input) {}
  async embed(input) {}
}
```

👉 可替换：

* DeepSeek
* Claude
* Gemini

---

## 5.3 AI 工厂模式

```ts
export const aiProvider =
  process.env.AI_PROVIDER === "openai"
    ? new OpenAIProvider()
    : new DeepSeekProvider();
```

---

# 🧩 6. RAG 系统（Pinecone）

---

## 6.1 向量库接口

```ts
interface VectorStore {
  upsert(vectors: any[]): Promise<void>;
  search(query: number[]): Promise<any[]>;
}
```

---

## 6.2 Pinecone 实现

```ts
import { Pinecone } from "@pinecone-database/pinecone";

export class PineconeStore implements VectorStore {
  private client = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });

  async upsert(vectors) {
    await this.client.index("auditlens").upsert(vectors);
  }

  async search(vector) {
    return await this.client.index("auditlens").query({
      vector,
      topK: 5,
      includeMetadata: true,
    });
  }
}
```

---

## 6.3 RAG Flow

```text
Risk Event
  ↓
Embedding Query
  ↓
Pinecone Search
  ↓
Return Policy Context
  ↓
LLM Explanation
```

---

# 🧠 7. Audit Graph（LangGraph）

---

## 7.1 Flow

```text
ParseExcel
  ↓
RuleCheck
  ↓
AnomalyDetection
  ↓
RiskScoring
  ↓
RAGExplain
  ↓
ReportGeneration
```

---

## 7.2 Node Example

```ts
export const ruleCheckNode = async (state) => {
  const duplicates = detectDuplicates(state.records);

  return {
    ...state,
    issues: duplicates,
  };
};
```

---

# 📊 8. 核心功能设计

---

## 8.1 数据上传

* Excel upload
* CSV upload

---

## 8.2 数据解析

输出结构：

```ts
type Record = {
  date: string;
  type: "income" | "expense";
  amount: number;
  vendor: string;
  invoiceId: string;
  category?: string;
  department?: string;
  region?: string;
  approvedBy?: string;
};
```

---

## 8.3 风险检测模块

### ① 重复检测

* invoiceId duplicate

---

### ② 金额异常

```text
amount > avg * 5
```

---

### ③ 供应商集中

---

### ④ 审批缺失

---

## 8.4 Risk Scoring

```ts
score = 100
- duplicates * 10
- anomalies * 5
- missingApproval * 8
```

---

## 8.5 AI解释模块

输入：

```text
risk + data + rule
```

输出：

* 为什么风险
* 对应规则
* 建议

---

## 8.6 自动报告生成

结构：

```text
Executive Summary
Findings
Risk Analysis
Recommendations
```

---

# 🗄 9. Supabase 数据模型

---

## users（auth自动）

---

## audit_tasks

```sql
id
user_id
file_name
status
score
created_at
```

---

## audit_issues

```sql
id
task_id
type
severity
reason
metadata
```

---

## audit_reports

```sql
id
task_id
content
created_at
```

---

## knowledge_base（RAG）

```sql
id
content
embedding vector
category
```

---

# 🧩 10. Next.js 目录结构（最终版）

```text
/app
  /login
  /dashboard
  /upload
  /report/[id]

/components
  UploadCard.tsx
  RiskScoreCard.tsx
  IssueTable.tsx
  ReportViewer.tsx

/lib
  supabase.ts
  ai-provider.ts
  pinecone.ts

/server
  audit-engine.ts
  langgraph.ts
  rules.ts
  anomaly.ts
  rag.ts

/types
  audit.ts
```

---

# 🎨 11. UI设计规范（企业级）

## 风格

* Fintech Dashboard
* Bloomberg / SAP 风格

---

## 颜色

```css
primary: #1E3A8A
danger: #EF4444
warning: #F59E0B
success: #16A34A
bg: #F8FAFC
```

---

## 页面结构

### Upload

* drag & drop
* analyze button

---

### Dashboard

* KPI cards
* risk chart
* issue table

---

### Report

* structured document UI

---

# 🚀 12. 安全 & 可扩展设计

---

## ✔ AI可替换

* OpenAI
* DeepSeek
* Claude

---

## ✔ RAG可替换

* Pinecone
* Weaviate
* pgvector

---

## ✔ DB可替换

* Supabase
* Postgres
* Neon

---

# 🏆 13. 比赛亮点总结

---

## ⭐ 业务价值

* 自动审计
* 减少人工检查

---

## ⭐ 技术亮点

* LangGraph workflow
* RAG（Pinecone）
* 可插拔AI架构
* Supabase Auth

---

## ⭐ Demo效果

* 上传Excel
* 秒出风险
* 自动生成报告

---
