# AuditLens AI

面向审计/税务场景的智能风险分析系统。

## 快速开始

```bash
npm install
cp .env.example .env.local   # 填入 Supabase / AI / Pinecone 密钥
npm run dev                    # http://localhost:3000
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发（Turbopack） |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint 检查 |
| `npm run typecheck` | TypeScript 类型检查 |

## 文档

- [AGENT.md](./AGENT.md) — AI 操作指令
- [PROJECT.md](./PROJECT.md) — 架构地图
- [todo.md](./todo.md) — 实施进度
- [docs/architecture.md](./docs/architecture.md) — 完整架构
- [docs/init.md](./docs/init.md) — MVP 规格

## 当前进度

Phase 1 类型与 Supabase 数据模型已完成。下一步：Phase 2 认证与路由保护。

配置 Supabase：见 [docs/supabase-setup.md](./docs/supabase-setup.md)
