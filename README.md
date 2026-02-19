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
| AI 管线 | LangGraph, LangChain, 多模型支持（OpenAI, Anthropic, Google Gemini, Ollama, OpenAI 兼容） |
| 测试 | Vitest, fast-check |
| CI/CD | GitHub Actions → ghcr.io |

## 快速开始

### 环境要求

- Node.js 20+
- Supabase 项目（含 pgvector 扩展）
- 至少一个 AI 模型提供商的 API Key（OpenAI / Anthropic / Google 等，或国产模型）

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
| `OPENAI_API_KEY` | OpenAI API Key（使用 OpenAI 时） | 视 provider |
| `ANTHROPIC_API_KEY` | Anthropic API Key | ❌ |
| `GOOGLE_API_KEY` | Google AI API Key | ❌ |
| `OLLAMA_BASE_URL` | Ollama 服务地址（默认 `http://localhost:11434`） | ❌ |
| `EXTRACTION_PROVIDER` / `EXTRACTION_MODEL` | 结构化提取的 provider 和模型 | ❌（默认 openai/gpt-4o） |
| `CHAT_PROVIDER` / `CHAT_MODEL` | 聊天回答的 provider 和模型 | ❌（默认 openai/gpt-4o） |
| `INTENT_PROVIDER` / `INTENT_MODEL` | 意图分析的 provider 和模型 | ❌（默认 openai/gpt-4o） |
| `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL` | Embedding 的 provider 和模型 | ❌（默认 openai/text-embedding-3-small） |
| `EMBEDDING_DIMENSIONS` | 向量维度 | ❌（默认 1536） |
| `{PURPOSE}_BASE_URL` / `{PURPOSE}_API_KEY` | openai-compatible 模式的接入地址和密钥 | openai-compatible 时必填 |
| `{PURPOSE}_STRUCTURED_OUTPUT` | 结构化输出模式（auto/native/json_prompt） | ❌（默认 auto） |
| `LANGSMITH_API_KEY` | LangSmith Key（调试用） | ❌ |
| `LANGSMITH_PROJECT` | LangSmith 项目名 | ❌ |

> 完整变量列表和国产模型配置示例见 `.env.local.example`。

### 数据库迁移

在 Supabase SQL Editor 中依次执行：

```
supabase/migrations/00001_initial_schema.sql
supabase/migrations/00002_add_scripts_table.sql
supabase/migrations/00003_flexible_vector_dimensions.sql
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

> 如使用其他提供商，传入对应的环境变量即可（如 `CHAT_PROVIDER`、`CHAT_MODEL` 等）。

## 模型配置

系统支持为不同用途独立配置 AI 模型提供商，实现灵活混用。

### 用途说明

| 用途 | 环境变量前缀 | 说明 |
|---|---|---|
| 结构化提取 | `EXTRACTION_` | 从文档中提取角色、线索等实体 |
| 聊天回答 | `CHAT_` | RAG 问答的回答生成 |
| 意图分析 | `INTENT_` | 分析用户查询意图 |
| Embedding | `EMBEDDING_` | 文档和查询的向量化 |

### 支持的提供商

| 提供商 | LLM | Embedding | 说明 |
|---|---|---|---|
| `openai` | ✅ | ✅ | OpenAI GPT 系列 |
| `anthropic` | ✅ | ❌ | Anthropic Claude 系列 |
| `google-genai` | ✅ | ✅ | Google Gemini 系列 |
| `ollama` | ✅ | ✅ | 本地部署模型 |
| `openai-compatible` | ✅ | ✅ | 任何兼容 OpenAI API 的服务 |

### 结构化输出模式

通过 `{PURPOSE}_STRUCTURED_OUTPUT` 控制结构化输出策略：

- `auto`（默认）— 自动检测：openai / anthropic / google-genai 使用原生 function calling，其他退化为 JSON prompt
- `native` — 强制使用模型原生 `withStructuredOutput` 能力
- `json_prompt` — 在 prompt 中要求 JSON 输出，用 Zod 解析验证

### 国产模型接入

通过 `openai-compatible` 模式可接入豆包、通义千问、DeepSeek、智谱等国产模型：

```bash
# 以 DeepSeek 为例，用于聊天回答
CHAT_PROVIDER=openai-compatible
CHAT_MODEL=deepseek-chat
CHAT_BASE_URL=https://api.deepseek.com/v1
CHAT_API_KEY=your-deepseek-api-key

# 通义千问用于结构化提取
EXTRACTION_PROVIDER=openai-compatible
EXTRACTION_MODEL=qwen-max
EXTRACTION_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EXTRACTION_API_KEY=your-dashscope-api-key
```

更多国产模型配置示例见 `.env.local.example`。

### ⚠️ 切换 Embedding 模型注意事项

切换 Embedding 模型（或提供商）后，由于不同模型产生的向量维度和语义空间不同，**必须重新生成所有已有文档的向量数据**。不同模型的向量不能混合搜索。

步骤：
1. 更新 `EMBEDDING_PROVIDER`、`EMBEDDING_MODEL`、`EMBEDDING_DIMENSIONS` 环境变量
2. 重新上传所有文档，或通过数据库清除已有向量后重新执行摄入管线

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
  ai/                    # AI 模型工厂（多提供商抽象层）
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
