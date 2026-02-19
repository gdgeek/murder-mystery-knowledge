# 多模型提供商支持 (Multi-Model Provider)

## 概述
将系统从硬编码 OpenAI 改为支持任意 AI 模型提供商，且不同用途（提取、聊天、Embedding）可独立配置不同模型，实现混用能力。同时通过 OpenAI 兼容模式支持豆包（Doubao）、通义千问（Qwen）、智谱（GLM）、DeepSeek 等国产模型。

## 用户故事

### Story 1: 按用途独立配置模型提供商
作为系统管理员，我希望能为不同用途（结构化提取、意图分析、回答生成、Embedding）分别配置不同的模型提供商和模型名称，以便根据成本和效果灵活选择。

**验收标准：**
- [ ] AC1: 通过环境变量可分别配置 4 个用途的 provider 和 model：`EXTRACTION_PROVIDER`/`EXTRACTION_MODEL`、`CHAT_PROVIDER`/`CHAT_MODEL`、`INTENT_PROVIDER`/`INTENT_MODEL`、`EMBEDDING_PROVIDER`/`EMBEDDING_MODEL`
- [ ] AC2: 未配置时有合理默认值（OpenAI gpt-4o / text-embedding-3-small）
- [ ] AC3: 支持的 LLM 提供商至少包括：openai、anthropic、google-genai、ollama、openai-compatible
- [ ] AC4: 支持的 Embedding 提供商至少包括：openai、ollama、google-genai、openai-compatible
- [ ] AC5: `openai-compatible` 模式支持通过 `{PURPOSE}_BASE_URL` 和 `{PURPOSE}_API_KEY` 接入任何兼容 OpenAI API 的模型（豆包、通义千问、智谱、DeepSeek 等）

### Story 2: 模型工厂抽象层
作为开发者，我希望有一个统一的工厂模块来创建 LLM 和 Embedding 实例，使业务代码不直接依赖任何特定提供商的 SDK。

**验收标准：**
- [ ] AC1: 新建 `lib/ai/provider.ts` 工厂模块，导出 `createChatModel()` 和 `createEmbeddings()` 函数
- [ ] AC2: 工厂函数返回 LangChain 基类类型（`BaseChatModel` / `Embeddings`）
- [ ] AC3: 现有 5 个文件中的 `ChatOpenAI` / `OpenAIEmbeddings` 直接引用全部替换为工厂调用
- [ ] AC4: 不支持的 provider 值抛出明确错误信息
- [ ] AC5: `openai-compatible` 模式下使用 `ChatOpenAI` / `OpenAIEmbeddings` 但传入自定义 `configuration.baseURL` 和 API Key

### Story 3: 结构化输出兼容性
作为开发者，我希望在模型不支持原生 function calling 时，系统能自动退化为 prompt + JSON 解析方式，保证结构化提取功能正常工作。

**验收标准：**
- [ ] AC1: 对支持 `withStructuredOutput` 的模型（openai、anthropic、google-genai、以及声明支持的 openai-compatible 模型）直接使用原生能力
- [ ] AC2: 对不支持的模型（如 ollama、部分 openai-compatible），退化为在 prompt 中要求 JSON 输出 + Zod 解析验证
- [ ] AC3: 退化模式下提取失败时抛出包含原始 LLM 输出的错误，便于调试
- [ ] AC4: 新增环境变量 `{PURPOSE}_STRUCTURED_OUTPUT=native|json_prompt` 允许用户手动指定结构化输出模式，默认 auto（自动检测）

### Story 4: Embedding 维度兼容
作为系统管理员，我希望切换 Embedding 模型时系统能正确处理不同的向量维度。

**验收标准：**
- [ ] AC1: 新增环境变量 `EMBEDDING_DIMENSIONS` 用于指定向量维度，默认 1536
- [ ] AC2: 数据库迁移脚本将 `vector(1536)` 改为可配置维度（通过新迁移文件）
- [ ] AC3: README 中说明切换 Embedding 模型时需要重新生成向量数据

### Story 5: 环境变量文档和验证
作为系统管理员，我希望有清晰的配置文档和启动时验证，避免配置错误导致运行时崩溃。

**验收标准：**
- [ ] AC1: `.env.local.example` 更新，包含所有新增环境变量及注释说明，并附国产模型配置示例（豆包、通义千问、DeepSeek）
- [ ] AC2: 工厂模块在缺少必要 API Key 或 Base URL 时给出明确错误提示
- [ ] AC3: README 更新模型配置说明，包含国产模型接入示例
