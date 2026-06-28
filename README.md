# AuditLens AI

面向审计/税务场景的智能风险分析系统：上传财务表格 → LangGraph 审计流水线 → 规则/异常/RAG/LLM → Dashboard 与报告展示。

## 环境要求

- Node.js 20+
- npm 10+
- [Supabase](https://supabase.com) 项目（Auth + Postgres）
- （可选）OpenAI 或阿里云百炼 API Key + Pinecone，用于 RAG 解释与 AI 报告

## 安装

```bash
git clone <repo-url> AuditLens
cd AuditLens
npm install
cp .env.example .env.local
```

在 `.env.local` 中至少配置：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

可选（启用 AI 解释与向量检索）：

| 变量 | 说明 |
|------|------|
| `AI_PROVIDER` | `openai`（默认）或 `qwen` |
| `OPENAI_API_KEY` | OpenAI API Key |
| `DASHSCOPE_API_KEY` | 百炼 Key（`AI_PROVIDER=qwen` 时） |
| `PINECONE_API_KEY` | Pinecone API Key |
| `PINECONE_INDEX` | 索引名，默认 `auditlens`（1536 维） |

完整变量说明见 [`.env.example`](./.env.example)。

## 数据库与账号

1. 按 [docs/supabase-setup.md](./docs/supabase-setup.md) 创建项目、执行迁移、启用 Email 登录
2. 在 Supabase Dashboard → **Authentication → Users** 创建 Demo 测试账号
3. （可选）配置 LLM + Pinecone 后执行知识库种子：

```bash
npm run seed:kb
```

## 启动

```bash
npm run dev      # http://localhost:3000
npm run build    # 生产构建
npm run start    # 生产模式运行
```

## Demo 演示步骤

适合比赛或路演的一键演示路径：

1. **登录** — 打开 `/login`，使用 Supabase 测试账号登录
2. **上传** — 进入 `/upload`，上传 [`fixtures/demo-financial-audit.csv`](./fixtures/demo-financial-audit.csv)（或 `fixtures/sample-audit.csv`）
3. **等待分析** — 点击「开始分析」，系统将运行完整 LangGraph 流水线（规则 → 异常 → 评分 → RAG → 报告）
4. **查看仪表盘** — 自动跳转 `/dashboard`，查看风险评分、分布图与问题列表
5. **查看报告** — 点击「查看报告」进入 `/report/[id]`，阅读结构化审计报告

> 未配置 LLM/Pinecone 时，确定性规则、异常检测、评分与模板报告仍可正常演示；仅 RAG 解释与 AI 增强报告会降级。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发（Turbopack） |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint 检查 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test:audit` | 审计引擎单测 |
| `npm run seed:kb` | 写入 RAG 知识库种子 |

## 文档

- [AGENT.md](./AGENT.md) — AI 操作指令
- [PROJECT.md](./PROJECT.md) — 架构地图
- [todo.md](./todo.md) — 实施进度
- [docs/business-decisions.md](./docs/business-decisions.md) — 业务规则/阈值/评分
- [docs/architecture.md](./docs/architecture.md) — 完整架构
- [docs/supabase-setup.md](./docs/supabase-setup.md) — Supabase 配置

## 当前进度

**Phase 9 打磨与交付已完成** — 全链路 Demo 可稳定复现。详见 [todo.md](./todo.md)。
