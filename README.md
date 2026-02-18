# 剧本杀知识库系统

基于 AI 的剧本杀文档处理与知识管理平台。系统能够读取大量剧本杀 PDF 文档，利用 LLM 自动提取结构化信息，构建可查询的知识库，并支持智能问答。

## 架构概览

```
┌──────────────────┐    上传 PDF     ┌─────────────────────────┐
│  前端 (Next.js)  │ ──────────────> │  Ingestion Pipeline     │
│  - 文档上传      │                 │  PDF解析 → 分块 → 向量化 │
│  - 聊天问答      │                 └────────┬────────────────┘
│  - 结构化检索    │                          │
└──────┬───────────┘                          ▼
       │              提问/检索      ┌─────────────────────────┐
       │ ──────────────────────────> │  Extraction Pipeline    │
       │                             │  LLM 结构化信息提取     │
       │                             └────────┬────────────────┘
       │                                      ▼
       │ <────────────────────────── ┌─────────────────────────┐
       │         流式回答            │  Retrieval Pipeline     │
       │                             │  混合检索 → LLM 生成回答 │
       └─────────────────────────── └─────────────────────────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │   Supabase      │
                                     │  PostgreSQL +   │
                                     │  pgvector       │
                                     └─────────────────┘
```

## 核心功能

### 文档摄入
- PDF 文档上传与文本提取
- 语义分块与向量化存储

### 结构化信息提取（13 种 Schema）
- **剧本元数据**：名称、作者、人数、时长、难度、类型标签
- **诡计与案例**：密室、不在场证明、凶器隐藏、毒杀、伪装等
- **角色信息**：身份、动机、性格、角色关系网络
- **剧本结构**：时间线、场景、分幕结构
- **故事背景**：时代、地点、世界观、社会环境
- **剧本格式**：分幕组成、排版风格、线索册结构
- **玩家剧本**：各角色剧本内容组成与字数统计
- **线索系统**：线索类型、位置、关联角色、指向性
- **推理链**：从线索到结论的逻辑推导路径
- **误导手段**：虚假线索、时间误导、身份伪装等
- **游戏机制**：玩法类型、特殊环节、胜利条件
- **叙事技法**：叙事视角、结构类型、悬念设置、伏笔
- **情感设计**：情感弧线、高潮点、目标情感

### 混合检索
- 结构化查询（按类型、身份、时代等多维度筛选）
- 语义搜索（自然语言相似度检索）
- RRF 算法合并排序

### 智能问答
- 基于知识库的 LLM 问答
- 流式响应 + 引用来源标注
- 多轮对话上下文维护

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js (App Router), React, Tailwind CSS |
| 后端 | Next.js API Routes, TypeScript |
| AI 编排 | LangGraph, LangChain |
| LLM | OpenAI GPT-4o, text-embedding-3-small |
| 数据库 | Supabase (PostgreSQL + pgvector) |
| 可观测性 | LangSmith |
| 测试 | Vitest, fast-check |

## 快速开始

### 前置条件

- Node.js v18+
- Supabase 项目（启用 pgvector 扩展）
- OpenAI API Key

### 安装

```bash
git clone git@github.com:gdgeek/murder-mystery-knowledge.git
cd murder-mystery-knowledge
npm install
```

### 环境变量

复制 `.env.local.example` 为 `.env.local` 并填入：

```env
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
OPENAI_API_KEY=your-openai-api-key
LANGSMITH_API_KEY=your-langsmith-api-key  # 可选
```

### 数据库初始化

将 `supabase/migrations/` 中的 SQL 迁移文件在 Supabase 中执行。

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 项目结构

```
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── upload/               # 文档上传
│   │   ├── chat/                 # 聊天问答 (SSE)
│   │   ├── search/               # 结构化检索
│   │   └── documents/            # 文档列表
│   ├── upload/                   # 上传页面
│   ├── chat/                     # 聊天页面
│   └── search/                   # 检索页面
├── components/                   # React 组件
├── lib/
│   ├── schemas/                  # Zod Schema 定义
│   ├── services/                 # 数据库服务层
│   ├── workflows/
│   │   ├── ingestion/            # 摄入管线
│   │   ├── extraction/           # 提取管线
│   │   └── retrieval/            # 检索管线
│   └── supabase.ts               # Supabase 客户端
├── supabase/migrations/          # 数据库迁移
├── __tests__/                    # 测试文件
└── .kiro/specs/                  # Spec 文档
```

## 参考

- [ai-pdf-chatbot-langchain](https://github.com/mayooear/ai-pdf-chatbot-langchain) — 参考架构
- [Learning LangChain (O'Reilly)](https://www.oreilly.com/library/view/learning-langchain/9781098167271/) — 配套书籍
- [LangGraph 文档](https://langchain-ai.github.io/langgraph/)
- [LangChain.js 文档](https://js.langchain.com)

## License

MIT
