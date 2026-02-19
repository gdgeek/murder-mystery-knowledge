# 多模型提供商支持 - 实现任务

## Tasks

- [x] 1. 新建模型工厂模块 `lib/ai/provider.ts`
  - [x] 1.1 实现 `createChatModel(purpose, options?)` 函数，支持 openai / anthropic / google-genai / ollama / openai-compatible 五种 provider，从 `{PURPOSE}_PROVIDER` 和 `{PURPOSE}_MODEL` 环境变量读取配置，返回 `BaseChatModel` 实例
    - Requirements: Story 1 AC1-AC5, Story 2 AC1-AC2
  - [x] 1.2 实现 `createEmbeddings(options?)` 函数，支持 openai / ollama / google-genai / openai-compatible 四种 provider，从 `EMBEDDING_*` 环境变量读取配置，返回 `Embeddings` 实例
    - Requirements: Story 1 AC1-AC5, Story 2 AC1-AC2
  - [x] 1.3 实现 `createStructuredModel(purpose, schema, options?)` 函数，根据 `{PURPOSE}_STRUCTURED_OUTPUT` 环境变量（auto/native/json_prompt）选择结构化输出策略；native 模式使用 `withStructuredOutput`，json_prompt 模式在 prompt 中追加 JSON schema 要求并用 Zod 解析验证
    - Requirements: Story 3 AC1-AC4
  - [x] 1.4 实现配置验证逻辑：不支持的 provider 抛出明确错误；openai-compatible 模式缺少 BASE_URL 或 API_KEY 时抛出错误；其他 provider 缺少对应 API Key 时抛出错误
    - Requirements: Story 2 AC4, Story 5 AC2
  - [x] 1.5 为工厂模块编写单元测试 `__tests__/lib/ai/provider.test.ts`，测试各 provider 的实例化、默认值、错误处理、结构化输出模式选择
    - Requirements: Story 2 AC1-AC5

- [x] 2. 安装新增依赖
  - [x] 2.1 在 `package.json` 中添加 `@langchain/anthropic`、`@langchain/google-genai`、`@langchain/ollama` 依赖并执行 `npm install`
    - Requirements: Story 1 AC3-AC4

- [x] 3. 替换 extractor.ts 中的 OpenAI 硬编码
  - [x] 3.1 修改 `lib/workflows/extraction/extractor.ts`：移除 `ChatOpenAI` import，改用 `createStructuredModel("extraction", schema)` 创建结构化输出模型；更新 `ExtractorOptions` 类型移除 `modelName`
    - Requirements: Story 2 AC3
  - [x] 3.2 更新 `__tests__/lib/workflows/extraction/extractor.test.ts` 测试，mock `lib/ai/provider` 模块而非 `@langchain/openai`
    - Requirements: Story 2 AC3

- [x] 4. 替换 analyze-intent.ts 中的 OpenAI 硬编码
  - [x] 4.1 修改 `lib/workflows/retrieval/nodes/analyze-intent.ts`：移除 `ChatOpenAI` import，改用 `createStructuredModel("intent", IntentAnalysisResultSchema)` 创建结构化输出模型
    - Requirements: Story 2 AC3
  - [x] 4.2 更新 `__tests__/lib/workflows/retrieval/nodes/analyze-intent.test.ts` 测试，mock `lib/ai/provider` 模块
    - Requirements: Story 2 AC3

- [x] 5. 替换 generate-answer.ts 中的 OpenAI 硬编码
  - [x] 5.1 修改 `lib/workflows/retrieval/nodes/generate-answer.ts`：移除 `ChatOpenAI` import，改用 `createChatModel("chat")` 创建 LLM 实例（普通回答和流式回答两处）
    - Requirements: Story 2 AC3
  - [x] 5.2 更新 `__tests__/lib/workflows/retrieval/nodes/generate-answer.test.ts` 测试，mock `lib/ai/provider` 模块
    - Requirements: Story 2 AC3

- [x] 6. 替换 embed-chunks.ts 中的 OpenAI 硬编码
  - [x] 6.1 修改 `lib/workflows/ingestion/nodes/embed-chunks.ts`：移除 `OpenAIEmbeddings` import，改用 `createEmbeddings()` 创建 Embedding 实例；更新函数签名将 `embeddings` 参数类型从 `OpenAIEmbeddings` 改为 `Embeddings`
    - Requirements: Story 2 AC3
  - [x] 6.2 更新 `__tests__/lib/workflows/ingestion/nodes/embed-chunks.test.ts` 测试，mock `lib/ai/provider` 模块
    - Requirements: Story 2 AC3

- [x] 7. 替换 semantic-search.ts 中的 OpenAI 硬编码
  - [x] 7.1 修改 `lib/workflows/retrieval/nodes/semantic-search.ts`：移除 `OpenAIEmbeddings` import，改用 `createEmbeddings()` 创建 Embedding 实例；更新函数签名将 `embeddings` 参数类型从 `OpenAIEmbeddings` 改为 `Embeddings`
    - Requirements: Story 2 AC3
  - [x] 7.2 更新 `__tests__/lib/workflows/retrieval/nodes/semantic-search.test.ts` 测试，mock `lib/ai/provider` 模块
    - Requirements: Story 2 AC3

- [x] 8. 数据库迁移 — 灵活向量维度
  - [x] 8.1 新建 `supabase/migrations/00003_flexible_vector_dimensions.sql`，将 `document_chunks.embedding` 列从 `vector(1536)` 改为 `vector`（不限维度）
    - Requirements: Story 4 AC1-AC2

- [x] 9. 更新环境变量文档
  - [x] 9.1 更新 `.env.local.example`，添加所有新增环境变量（EXTRACTION_PROVIDER/MODEL/BASE_URL/API_KEY、CHAT_*、INTENT_*、EMBEDDING_*、ANTHROPIC_API_KEY、GOOGLE_API_KEY、OLLAMA_BASE_URL）及国产模型配置示例注释
    - Requirements: Story 5 AC1

- [x] 10. 更新 README
  - [x] 10.1 更新 `README.md`：技术栈表格更新（AI 管线支持多模型）、环境变量表格更新、新增"模型配置"章节说明各用途独立配置方法和国产模型接入示例、说明切换 Embedding 模型需重新生成向量
    - Requirements: Story 4 AC3, Story 5 AC3

- [x] 11. 全量测试验证
  - [x] 11.1 运行 `npm test` 确保所有现有测试通过，无回归问题
    - Requirements: All Stories
