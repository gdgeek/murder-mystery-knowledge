# 剧本杀知识库 (Murder Mystery Knowledge Base)

基于 Next.js + Supabase + LangGraph 的剧本杀知识库系统。支持 PDF 文档上传、结构化数据提取（角色、诡计、线索等 13 类实体）、语义搜索和 AI 聊天问答。

## 功能

- **文档管理** — PDF 上传、解析、分块、向量化
- **多文档剧本归组** — 将多个 PDF 归组到同一剧本，支持批量上传
- **结构化提取** — 自动提取角色、诡计、线索、推理链等 13 类实体
- **跨文档去重** — 同一剧本下自动按名称去重角色和诡计
- **混合搜索** — 结构化查询 + 语义搜索，RRF 融合排序
- **AI 聊天** — 基于知识库的 RAG 问答

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16, React 19, Tailwind CSS 4 |
| 后端 | Next.js App Router API Routes |
| 数据库 | Supabase (PostgreSQL + pgvector) |
| AI 管线 | LangGraph, LangChain, OpenAI |
| 测试 | Vitest, fast-check |
| CI/CD | GitHub Actions → ghcr.io |

## 快速开始

### 环境要求

- Node.js 20+
- Supabase 项目（含 pgvector 扩展）
- OpenAI API Key

### 安装

```bash
git clone git@github.com:gdgeek/murder-mystery-knowledge.git
cd murder-mystery-knowledge
npm install
```

### 配置环境变量

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`，填入：

| 变量 | 说明 | 必填 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 Key | ✅ |
| `OPENAI_API_KEY` | OpenAI API Key | ✅ |
| `LANGSMITH_API_KEY` | LangSmith Key（调试用） | ❌ |
| `LANGSMITH_PROJECT` | LangSmith 项目名 | ❌ |

### 数据库迁移

在 Supabase SQL Editor 中依次执行：

```
supabase/migrations/00001_initial_schema.sql
supabase/migrations/00002_add_scripts_table.sql
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 常用命令

```bash
npm run dev       # 开发服务器
npm run build     # 生产构建
npm run start     # 生产启动
npm run lint      # ESLint 检查
npm test          # 运行测试
```

## Docker 部署

```bash
# 构建镜像
docker build -t murder-mystery-kb .

# 运行容器
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your-url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
  -e OPENAI_API_KEY=your-key \
  murder-mystery-kb
```

## CI/CD

推送到 `main` 分支会自动触发 GitHub Actions：

1. **test** — lint + 全量测试
2. **build-and-push** — 构建 Docker 镜像并推送到 `ghcr.io`

拉取镜像：

```bash
docker pull ghcr.io/gdgeek/murder-mystery-knowledge:latest
```

## 项目结构

```
app/                    # Next.js App Router 页面和 API
  api/
    chat/               # AI 聊天 API
    documents/           # 文档列表 API
    scripts/             # 剧本管理 API
    search/              # 搜索 API
    upload/              # 文件上传 API
  chat/                  # 聊天页面
  search/                # 搜索页面
  upload/                # 上传页面
components/              # React 组件
lib/
  schemas/               # Zod 数据模型
  services/              # 业务逻辑层
  workflows/
    ingestion/           # 文档摄入管线（解析→分块→向量化）
    extraction/          # 结构化提取管线（LLM 提取→置信度→存储）
    retrieval/           # 检索管线（意图分析→搜索→生成回答）
supabase/migrations/     # 数据库迁移文件
__tests__/               # 测试文件
```

## License

MIT
