import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Mock classes — lightweight stubs that record constructor args
// ---------------------------------------------------------------------------

class MockChatOpenAI {
  opts: Record<string, unknown>;
  constructor(opts: Record<string, unknown> = {}) {
    this.opts = opts;
  }
  withStructuredOutput(schema: unknown, options?: unknown) {
    return { _type: "structured", schema, options };
  }
}

class MockChatAnthropic {
  opts: Record<string, unknown>;
  constructor(opts: Record<string, unknown> = {}) {
    this.opts = opts;
  }
  withStructuredOutput(schema: unknown, options?: unknown) {
    return { _type: "structured", schema, options };
  }
}

class MockChatGoogleGenerativeAI {
  opts: Record<string, unknown>;
  constructor(opts: Record<string, unknown> = {}) {
    this.opts = opts;
  }
  withStructuredOutput(schema: unknown, options?: unknown) {
    return { _type: "structured", schema, options };
  }
}

class MockChatOllama {
  opts: Record<string, unknown>;
  constructor(opts: Record<string, unknown> = {}) {
    this.opts = opts;
  }
  withStructuredOutput(schema: unknown, options?: unknown) {
    return { _type: "structured", schema, options };
  }
}

class MockOpenAIEmbeddings {
  opts: Record<string, unknown>;
  constructor(opts: Record<string, unknown> = {}) {
    this.opts = opts;
  }
}

class MockOllamaEmbeddings {
  opts: Record<string, unknown>;
  constructor(opts: Record<string, unknown> = {}) {
    this.opts = opts;
  }
}

class MockGoogleGenerativeAIEmbeddings {
  opts: Record<string, unknown>;
  constructor(opts: Record<string, unknown> = {}) {
    this.opts = opts;
  }
}

// ---------------------------------------------------------------------------
// Mock dynamic imports — must be declared before importing module under test
// ---------------------------------------------------------------------------

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: MockChatOpenAI,
  OpenAIEmbeddings: MockOpenAIEmbeddings,
}));

vi.mock("@langchain/anthropic", () => ({
  ChatAnthropic: MockChatAnthropic,
}));

vi.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: MockChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings: MockGoogleGenerativeAIEmbeddings,
}));

vi.mock("@langchain/ollama", () => ({
  ChatOllama: MockChatOllama,
  OllamaEmbeddings: MockOllamaEmbeddings,
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------

import {
  createChatModel,
  createEmbeddings,
  createStructuredModel,
} from "../../../lib/ai/provider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Save original env and restore after each test */
const savedEnv: Record<string, string | undefined> = {};

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (!(key in savedEnv)) {
      savedEnv[key] = process.env[key];
    }
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function clearPurposeEnv() {
  const keys = [
    "EXTRACTION_PROVIDER", "EXTRACTION_MODEL", "EXTRACTION_BASE_URL", "EXTRACTION_API_KEY",
    "EXTRACTION_STRUCTURED_OUTPUT",
    "CHAT_PROVIDER", "CHAT_MODEL", "CHAT_BASE_URL", "CHAT_API_KEY",
    "CHAT_STRUCTURED_OUTPUT",
    "INTENT_PROVIDER", "INTENT_MODEL", "INTENT_BASE_URL", "INTENT_API_KEY",
    "INTENT_STRUCTURED_OUTPUT",
    "EMBEDDING_PROVIDER", "EMBEDDING_MODEL", "EMBEDDING_DIMENSIONS",
    "EMBEDDING_BASE_URL", "EMBEDDING_API_KEY",
    "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "OLLAMA_BASE_URL",
  ];
  for (const key of keys) {
    if (!(key in savedEnv)) {
      savedEnv[key] = process.env[key];
    }
    delete process.env[key];
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearPurposeEnv();
});

afterEach(() => {
  // Restore original env
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  // Clear saved
  for (const key of Object.keys(savedEnv)) {
    delete savedEnv[key];
  }
});

// ============================================================================
// createChatModel
// ============================================================================

describe("createChatModel", () => {
  it("defaults to openai + gpt-4o when no env vars set", async () => {
    setEnv({ OPENAI_API_KEY: "sk-test" });

    const model = await createChatModel("chat");

    expect(model).toBeInstanceOf(MockChatOpenAI);
    expect((model as unknown as MockChatOpenAI).opts.modelName).toBe("gpt-4o");
  });

  it("creates ChatOpenAI for openai provider", async () => {
    setEnv({ CHAT_PROVIDER: "openai", CHAT_MODEL: "gpt-4o-mini", OPENAI_API_KEY: "sk-test" });

    const model = await createChatModel("chat");

    expect(model).toBeInstanceOf(MockChatOpenAI);
    expect((model as unknown as MockChatOpenAI).opts.modelName).toBe("gpt-4o-mini");
  });

  it("creates ChatAnthropic for anthropic provider", async () => {
    setEnv({ EXTRACTION_PROVIDER: "anthropic", EXTRACTION_MODEL: "claude-3-opus", ANTHROPIC_API_KEY: "ant-key" });

    const model = await createChatModel("extraction");

    expect(model).toBeInstanceOf(MockChatAnthropic);
    expect((model as unknown as MockChatAnthropic).opts.modelName).toBe("claude-3-opus");
  });

  it("creates ChatGoogleGenerativeAI for google-genai provider", async () => {
    setEnv({ INTENT_PROVIDER: "google-genai", INTENT_MODEL: "gemini-pro", GOOGLE_API_KEY: "goog-key" });

    const model = await createChatModel("intent");

    expect(model).toBeInstanceOf(MockChatGoogleGenerativeAI);
    expect((model as unknown as MockChatGoogleGenerativeAI).opts.model).toBe("gemini-pro");
  });

  it("creates ChatOllama for ollama provider", async () => {
    setEnv({ CHAT_PROVIDER: "ollama", CHAT_MODEL: "llama3" });

    const model = await createChatModel("chat");

    expect(model).toBeInstanceOf(MockChatOllama);
    expect((model as unknown as MockChatOllama).opts.model).toBe("llama3");
  });

  it("creates ChatOpenAI with custom baseURL for openai-compatible provider", async () => {
    setEnv({
      CHAT_PROVIDER: "openai-compatible",
      CHAT_MODEL: "deepseek-chat",
      CHAT_BASE_URL: "https://api.deepseek.com/v1",
      CHAT_API_KEY: "ds-key",
    });

    const model = await createChatModel("chat");

    expect(model).toBeInstanceOf(MockChatOpenAI);
    const opts = (model as unknown as MockChatOpenAI).opts;
    expect(opts.modelName).toBe("deepseek-chat");
    expect(opts.configuration).toEqual({ baseURL: "https://api.deepseek.com/v1" });
    expect(opts.apiKey).toBe("ds-key");
  });

  it("throws for unsupported provider", async () => {
    setEnv({ CHAT_PROVIDER: "unsupported-llm" });

    await expect(createChatModel("chat")).rejects.toThrow(
      /Unsupported LLM provider: "unsupported-llm"/,
    );
  });

  it("throws when openai-compatible BASE_URL is missing", async () => {
    setEnv({ CHAT_PROVIDER: "openai-compatible", CHAT_API_KEY: "key" });

    await expect(createChatModel("chat")).rejects.toThrow(
      "CHAT_BASE_URL is required for openai-compatible provider",
    );
  });

  it("throws when openai-compatible API_KEY is missing", async () => {
    setEnv({ CHAT_PROVIDER: "openai-compatible", CHAT_BASE_URL: "https://example.com" });

    await expect(createChatModel("chat")).rejects.toThrow(
      "CHAT_API_KEY is required for openai-compatible provider",
    );
  });

  it("throws when openai provider OPENAI_API_KEY is missing", async () => {
    // OPENAI_API_KEY is already cleared by clearPurposeEnv
    await expect(createChatModel("chat")).rejects.toThrow(
      "OPENAI_API_KEY environment variable is required for openai provider",
    );
  });

  it("throws when anthropic provider ANTHROPIC_API_KEY is missing", async () => {
    setEnv({ CHAT_PROVIDER: "anthropic" });

    await expect(createChatModel("chat")).rejects.toThrow(
      "ANTHROPIC_API_KEY environment variable is required for anthropic provider",
    );
  });

  it("throws when google-genai provider GOOGLE_API_KEY is missing", async () => {
    setEnv({ CHAT_PROVIDER: "google-genai" });

    await expect(createChatModel("chat")).rejects.toThrow(
      "GOOGLE_API_KEY environment variable is required for google-genai provider",
    );
  });

  it("passes temperature option through", async () => {
    setEnv({ OPENAI_API_KEY: "sk-test" });

    const model = await createChatModel("chat", { temperature: 0.3 });

    expect((model as unknown as MockChatOpenAI).opts.temperature).toBe(0.3);
  });
});

// ============================================================================
// createEmbeddings
// ============================================================================

describe("createEmbeddings", () => {
  it("defaults to openai + text-embedding-3-small + 1536 dimensions", async () => {
    setEnv({ OPENAI_API_KEY: "sk-test" });

    const emb = await createEmbeddings();

    expect(emb).toBeInstanceOf(MockOpenAIEmbeddings);
    const opts = (emb as unknown as MockOpenAIEmbeddings).opts;
    expect(opts.modelName).toBe("text-embedding-3-small");
    expect(opts.dimensions).toBe(1536);
  });

  it("creates OpenAIEmbeddings for openai provider", async () => {
    setEnv({ EMBEDDING_PROVIDER: "openai", EMBEDDING_MODEL: "text-embedding-ada-002", OPENAI_API_KEY: "sk-test" });

    const emb = await createEmbeddings();

    expect(emb).toBeInstanceOf(MockOpenAIEmbeddings);
    expect((emb as unknown as MockOpenAIEmbeddings).opts.modelName).toBe("text-embedding-ada-002");
  });

  it("creates OllamaEmbeddings for ollama provider", async () => {
    setEnv({ EMBEDDING_PROVIDER: "ollama", EMBEDDING_MODEL: "nomic-embed-text" });

    const emb = await createEmbeddings();

    expect(emb).toBeInstanceOf(MockOllamaEmbeddings);
    expect((emb as unknown as MockOllamaEmbeddings).opts.model).toBe("nomic-embed-text");
  });

  it("creates GoogleGenerativeAIEmbeddings for google-genai provider", async () => {
    setEnv({ EMBEDDING_PROVIDER: "google-genai", EMBEDDING_MODEL: "embedding-001", GOOGLE_API_KEY: "goog-key" });

    const emb = await createEmbeddings();

    expect(emb).toBeInstanceOf(MockGoogleGenerativeAIEmbeddings);
    expect((emb as unknown as MockGoogleGenerativeAIEmbeddings).opts.modelName).toBe("embedding-001");
  });

  it("creates OpenAIEmbeddings with custom baseURL for openai-compatible provider", async () => {
    setEnv({
      EMBEDDING_PROVIDER: "openai-compatible",
      EMBEDDING_MODEL: "custom-embed",
      EMBEDDING_BASE_URL: "https://custom.api/v1",
      EMBEDDING_API_KEY: "custom-key",
    });

    const emb = await createEmbeddings();

    expect(emb).toBeInstanceOf(MockOpenAIEmbeddings);
    const opts = (emb as unknown as MockOpenAIEmbeddings).opts;
    expect(opts.modelName).toBe("custom-embed");
    expect(opts.configuration).toEqual({ baseURL: "https://custom.api/v1" });
    expect(opts.apiKey).toBe("custom-key");
  });

  it("throws for unsupported embedding provider", async () => {
    setEnv({ EMBEDDING_PROVIDER: "bad-provider" });

    await expect(createEmbeddings()).rejects.toThrow(
      /Unsupported embedding provider: "bad-provider"/,
    );
  });

  it("throws when openai-compatible EMBEDDING_BASE_URL is missing", async () => {
    setEnv({ EMBEDDING_PROVIDER: "openai-compatible", EMBEDDING_API_KEY: "key" });

    await expect(createEmbeddings()).rejects.toThrow(
      "EMBEDDING_BASE_URL is required for openai-compatible provider",
    );
  });

  it("throws when openai-compatible EMBEDDING_API_KEY is missing", async () => {
    setEnv({ EMBEDDING_PROVIDER: "openai-compatible", EMBEDDING_BASE_URL: "https://example.com" });

    await expect(createEmbeddings()).rejects.toThrow(
      "EMBEDDING_API_KEY is required for openai-compatible provider",
    );
  });

  it("uses custom dimensions from env var", async () => {
    setEnv({ OPENAI_API_KEY: "sk-test", EMBEDDING_DIMENSIONS: "768" });

    const emb = await createEmbeddings();

    expect((emb as unknown as MockOpenAIEmbeddings).opts.dimensions).toBe(768);
  });
});

// ============================================================================
// createStructuredModel — structured output mode resolution
// ============================================================================

describe("createStructuredModel", () => {
  const TestSchema = z.object({ value: z.string() });

  describe("auto mode resolves to native for openai/anthropic/google-genai", () => {
    it("openai → native (withStructuredOutput)", async () => {
      setEnv({ EXTRACTION_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" });

      const runnable = await createStructuredModel("extraction", TestSchema);

      // In native mode, createStructuredModel calls llm.withStructuredOutput
      // which returns our mock object with _type: "structured"
      expect((runnable as unknown as { _type: string })._type).toBe("structured");
    });

    it("anthropic → native (withStructuredOutput)", async () => {
      setEnv({ CHAT_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "ant-key" });

      const runnable = await createStructuredModel("chat", TestSchema);

      expect((runnable as unknown as { _type: string })._type).toBe("structured");
    });

    it("google-genai → native (withStructuredOutput)", async () => {
      setEnv({ INTENT_PROVIDER: "google-genai", GOOGLE_API_KEY: "goog-key" });

      const runnable = await createStructuredModel("intent", TestSchema);

      expect((runnable as unknown as { _type: string })._type).toBe("structured");
    });
  });

  describe("auto mode resolves to json_prompt for ollama/openai-compatible", () => {
    it("ollama → json_prompt (RunnableLambda)", async () => {
      setEnv({ CHAT_PROVIDER: "ollama", CHAT_MODEL: "llama3" });

      const runnable = await createStructuredModel("chat", TestSchema);

      // json_prompt mode returns a RunnableLambda, not the withStructuredOutput mock
      expect((runnable as unknown as { _type?: string })._type).toBeUndefined();
      // It should be a Runnable (has invoke method)
      expect(typeof (runnable as { invoke: unknown }).invoke).toBe("function");
    });

    it("openai-compatible → json_prompt (RunnableLambda)", async () => {
      setEnv({
        EXTRACTION_PROVIDER: "openai-compatible",
        EXTRACTION_MODEL: "deepseek-chat",
        EXTRACTION_BASE_URL: "https://api.deepseek.com/v1",
        EXTRACTION_API_KEY: "ds-key",
      });

      const runnable = await createStructuredModel("extraction", TestSchema);

      expect((runnable as unknown as { _type?: string })._type).toBeUndefined();
      expect(typeof (runnable as { invoke: unknown }).invoke).toBe("function");
    });
  });

  describe("explicit env var overrides auto", () => {
    it("native override on ollama forces withStructuredOutput", async () => {
      setEnv({
        CHAT_PROVIDER: "ollama",
        CHAT_MODEL: "llama3",
        CHAT_STRUCTURED_OUTPUT: "native",
      });

      const runnable = await createStructuredModel("chat", TestSchema);

      // Explicit native override should use withStructuredOutput even for ollama
      expect((runnable as unknown as { _type: string })._type).toBe("structured");
    });

    it("json_prompt override on openai forces RunnableLambda", async () => {
      setEnv({
        EXTRACTION_PROVIDER: "openai",
        EXTRACTION_STRUCTURED_OUTPUT: "json_prompt",
        OPENAI_API_KEY: "sk-test",
      });

      const runnable = await createStructuredModel("extraction", TestSchema);

      // Should be a RunnableLambda, not the withStructuredOutput result
      expect((runnable as unknown as { _type?: string })._type).toBeUndefined();
      expect(typeof (runnable as { invoke: unknown }).invoke).toBe("function");
    });
  });
});
