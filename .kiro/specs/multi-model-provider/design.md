# 多模型提供商支持 - 设计文档

## 架构概览

引入 `lib/ai/` 抽象层，作为所有 AI 模型实例化的唯一入口。业务代码只依赖 LangChain 基类接口，不直接 import 任何提供商 SDK。

通过 `openai-compatible` 模式，任何兼容 OpenAI API 协议的国产模型（豆包、通义千问、智谱、DeepSeek 等）都可以直接接入，无需额外适配代码。

```
环境变量 (.env.local)
    ↓
lib/ai/provider.ts  ← 工厂模块（唯一入口）
    ├── createChatModel(purpose)  → BaseChatModel
    ├── createStructuredModel(purpose, schema)  → Runnable
    └── createEmbeddings()        → Embeddings
    ↓
lib/workflows/extraction/extractor.ts      (提取)
lib/workflows/retrieval/nodes/analyze-intent.ts  (意图分析)
lib/workflows/retrieval/nodes/generate-answer.ts (回答生成)
lib/workflows/ingestion/nodes/embed-chunks.ts    (文档向量化)
lib/workflows/retrieval/nodes/semantic-search.ts (查询向量化)
```

## 环境变量设计

```bash
# ============================================================================
# LLM 配置 - 按用途独立配置，支持混用
# provider 可选值: openai | anthropic | google-genai | ollama | openai-compatible
# ============================================================================

# 结构化提取
EXTRACTION_PROVIDER=openai
EXTRACTION_MODEL=gpt-4o
# EXTRACTION_BASE_URL=           # openai-compatible 模式必填
# EXTRACTION_API_KEY=            # openai-compatible 模式必填
# EXTRACTION_STRUCTURED_OUTPUT=auto  # auto | native | json_prompt

# 聊天回答
CHAT_PROVIDER=openai
CHAT_MODEL=gpt-4o
# CHAT_BASE_URL=
# CHAT_API_KEY=

# 意图分析
INTENT_PROVIDER=openai
INTENT_MODEL=gpt-4o
# INTENT_BASE_URL=
# INTENT_API_KEY=
# INTENT_STRUCTURED_OUTPUT=auto

# ============================================================================
# Embedding 配置
# provider 可选值: openai | ollama | google-genai | openai-compatible
# ============================================================================
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
# EMBEDDING_BASE_URL=
# EMBEDDING_API_KEY=

# ============================================================================
# 全局 API Keys（非 openai-compatible 模式使用）
# ============================================================================
OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
# GOOGLE_API_KEY=
# OLLAMA_BASE_URL=http://localhost:11434

# ============================================================================
# 国产模型配置示例（使用 openai-compatible 模式）
# ============================================================================
# --- 豆包 (Doubao / 火山引擎) ---
# CHAT_PROVIDER=openai-compatible
# CHAT_MODEL=doubao-pro-32k
# CHAT_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
# CHAT_API_KEY=your-ark-api-key
#
# --- 通义千问 (Qwen / 阿里云) ---
# CHAT_PROVIDER=openai-compatible
# CHAT_MODEL=qwen-max
# CHAT_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
# CHAT_API_KEY=your-dashscope-api-key
#
# --- DeepSeek ---
# CHAT_PROVIDER=openai-compatible
# CHAT_MODEL=deepseek-chat
# CHAT_BASE_URL=https://api.deepseek.com/v1
# CHAT_API_KEY=your-deepseek-api-key
#
# --- 智谱 (GLM / ZhipuAI) ---
# CHAT_PROVIDER=openai-compatible
# CHAT_MODEL=glm-4
# CHAT_BASE_URL=https://open.bigmodel.cn/api/paas/v4
# CHAT_API_KEY=your-zhipu-api-key
```

## 工厂模块设计 (`lib/ai/provider.ts`)

### LLM 用途枚举

```typescript
export type LLMPurpose = "extraction" | "chat" | "intent";
```

每个用途从对应的环境变量读取 provider 和 model。

### Provider 类型

```typescript
export type LLMProvider = "openai" | "anthropic" | "google-genai" | "ollama" | "openai-compatible";
export type EmbeddingProvider = "openai" | "ollama" | "google-genai" | "openai-compatible";
```

### createChatModel(purpose, options?)

1. 读取 `{PURPOSE}_PROVIDER` 和 `{PURPOSE}_MODEL` 环境变量
2. 根据 provider 值创建对应的 LangChain 实例：
   - `openai` → `ChatOpenAI`
   - `anthropic` → `ChatAnthropic`
   - `google-genai` → `ChatGoogleGenerativeAI`
   - `ollama` → `ChatOllama`
   - `openai-compatible` → `ChatOpenAI` + 自定义 `configuration.baseURL` + `{PURPOSE}_API_KEY`
3. 验证对应的 API Key / Base URL 存在
4. 返回 `BaseChatModel` 实例

### createEmbeddings(options?)

1. 读取 `EMBEDDING_PROVIDER`、`EMBEDDING_MODEL`、`EMBEDDING_DIMENSIONS`
2. 根据 provider 值创建对应实例：
   - `openai` → `OpenAIEmbeddings`
   - `ollama` → `OllamaEmbeddings`
   - `google-genai` → `GoogleGenerativeAIEmbeddings`
   - `openai-compatible` → `OpenAIEmbeddings` + 自定义 base URL + API Key
3. 返回 `Embeddings` 实例

### 结构化输出兼容 — createStructuredModel(purpose, schema, options?)

```typescript
export async function createStructuredModel<T extends z.ZodType>(
  purpose: LLMPurpose,
  schema: T,
  options?: { name?: string; temperature?: number },
): Promise<Runnable<unknown, z.infer<T>>>
```

逻辑：
1. 读取 `{PURPOSE}_STRUCTURED_OUTPUT` 环境变量（默认 `auto`）
2. `auto` 模式下：
   - openai / anthropic / google-genai → `native`
   - ollama / openai-compatible → `json_prompt`
3. `native` 模式：`llm.withStructuredOutput(schema)`
4. `json_prompt` 模式：
   - 在 system prompt 末尾追加 JSON schema 说明和输出格式要求
   - LLM 输出后用 `JSON.parse` + `schema.parse()` 验证
   - 解析失败时抛出包含原始输出的 `StructuredOutputError`

## 数据库变更

新增迁移 `00003_flexible_vector_dimensions.sql`：

```sql
-- 移除固定维度约束，改为不限维度的 vector 类型
ALTER TABLE document_chunks
  ALTER COLUMN embedding TYPE vector;
```

> 注意：改维度后已有向量数据需要重新生成。不同维度的向量不能混合搜索。

## 依赖变更 (package.json)

新增可选依赖（按需安装）：
- `@langchain/anthropic` — Anthropic Claude
- `@langchain/google-genai` — Google Gemini
- `@langchain/ollama` — Ollama 本地模型

> `openai-compatible` 模式复用 `@langchain/openai`，无需额外依赖。

## 受影响文件清单

| 文件 | 变更类型 |
|---|---|
| `lib/ai/provider.ts` | 新建 — 工厂模块 |
| `lib/workflows/extraction/extractor.ts` | 修改 — 替换 ChatOpenAI → createStructuredModel |
| `lib/workflows/retrieval/nodes/analyze-intent.ts` | 修改 — 替换 ChatOpenAI → createStructuredModel |
| `lib/workflows/retrieval/nodes/generate-answer.ts` | 修改 — 替换 ChatOpenAI → createChatModel |
| `lib/workflows/ingestion/nodes/embed-chunks.ts` | 修改 — 替换 OpenAIEmbeddings → createEmbeddings |
| `lib/workflows/retrieval/nodes/semantic-search.ts` | 修改 — 替换 OpenAIEmbeddings → createEmbeddings |
| `supabase/migrations/00003_flexible_vector_dimensions.sql` | 新建 |
| `.env.local.example` | 修改 — 新增环境变量及国产模型示例 |
| `README.md` | 修改 — 模型配置说明 |
| `package.json` | 修改 — 新增可选依赖 |
| 相关测试文件 | 修改 — 更新 mock |

## 测试框架

- Vitest
- fast-check（属性测试）
