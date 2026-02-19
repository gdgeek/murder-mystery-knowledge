// ============================================================================
// AI Model Factory Module
//
// Unified factory for creating LLM and Embedding instances.
// Business code depends only on LangChain base types, never on specific
// provider SDKs directly.
//
// Configuration is driven by environment variables per purpose:
//   {PURPOSE}_PROVIDER, {PURPOSE}_MODEL, {PURPOSE}_BASE_URL, {PURPOSE}_API_KEY
// ============================================================================

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Embeddings } from "@langchain/core/embeddings";
import { RunnableLambda, type Runnable } from "@langchain/core/runnables";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export type LLMPurpose = "extraction" | "chat" | "intent";

export type LLMProvider =
  | "openai"
  | "anthropic"
  | "google-genai"
  | "ollama"
  | "openai-compatible";

export type EmbeddingProvider =
  | "openai"
  | "ollama"
  | "google-genai"
  | "openai-compatible";

export interface ChatModelOptions {
  temperature?: number;
}

export interface EmbeddingOptions {
  dimensions?: number;
}

// ============================================================================
// Internal helpers
// ============================================================================

const DEFAULT_LLM_PROVIDER: LLMProvider = "openai";
const DEFAULT_LLM_MODEL = "gpt-4o";

const DEFAULT_EMBEDDING_PROVIDER: EmbeddingProvider = "openai";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

/**
 * Read provider / model / baseURL / apiKey for a given purpose from env vars.
 */
function readPurposeConfig(purpose: LLMPurpose) {
  const prefix = purpose.toUpperCase(); // EXTRACTION | CHAT | INTENT

  const provider =
    (process.env[`${prefix}_PROVIDER`] as LLMProvider | undefined) ??
    DEFAULT_LLM_PROVIDER;
  const model =
    process.env[`${prefix}_MODEL`] ?? DEFAULT_LLM_MODEL;
  const baseURL = process.env[`${prefix}_BASE_URL`];
  const apiKey = process.env[`${prefix}_API_KEY`];

  return { provider, model, baseURL, apiKey };
}

/**
 * Read embedding configuration from EMBEDDING_* environment variables.
 */
function readEmbeddingConfig() {
  const provider =
    (process.env.EMBEDDING_PROVIDER as EmbeddingProvider | undefined) ??
    DEFAULT_EMBEDDING_PROVIDER;
  const model =
    process.env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
  const dimensions = process.env.EMBEDDING_DIMENSIONS
    ? parseInt(process.env.EMBEDDING_DIMENSIONS, 10)
    : DEFAULT_EMBEDDING_DIMENSIONS;
  const baseURL = process.env.EMBEDDING_BASE_URL;
  const apiKey = process.env.EMBEDDING_API_KEY;

  return { provider, model, dimensions, baseURL, apiKey };
}

// ============================================================================
// createChatModel
// ============================================================================

/**
 * Create a chat model instance for the given purpose.
 *
 * Provider and model are resolved from environment variables:
 *   `{PURPOSE}_PROVIDER` (default: openai)
 *   `{PURPOSE}_MODEL`    (default: gpt-4o)
 *
 * For `openai-compatible` mode, `{PURPOSE}_BASE_URL` and `{PURPOSE}_API_KEY`
 * are required.
 */
export async function createChatModel(
  purpose: LLMPurpose,
  options: ChatModelOptions = {},
): Promise<BaseChatModel> {
  const { provider, model, baseURL, apiKey } = readPurposeConfig(purpose);
  const { temperature } = options;

  switch (provider) {
    case "openai": {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(
          "OPENAI_API_KEY environment variable is required for openai provider",
        );
      }
      const { ChatOpenAI } = await import("@langchain/openai");
      return new ChatOpenAI({
        modelName: model,
        ...(temperature != null && { temperature }),
      });
    }

    case "anthropic": {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error(
          "ANTHROPIC_API_KEY environment variable is required for anthropic provider",
        );
      }
      const { ChatAnthropic } = await import("@langchain/anthropic");
      return new ChatAnthropic({
        modelName: model,
        ...(temperature != null && { temperature }),
      });
    }

    case "google-genai": {
      if (!process.env.GOOGLE_API_KEY) {
        throw new Error(
          "GOOGLE_API_KEY environment variable is required for google-genai provider",
        );
      }
      const { ChatGoogleGenerativeAI } =
        await import("@langchain/google-genai");
      return new ChatGoogleGenerativeAI({
        model,
        ...(temperature != null && { temperature }),
      });
    }

    case "ollama": {
      const { ChatOllama } = await import("@langchain/ollama");
      return new ChatOllama({
        model,
        ...(temperature != null && { temperature }),
      });
    }

    case "openai-compatible": {
      if (!baseURL) {
        throw new Error(
          `${purpose.toUpperCase()}_BASE_URL is required for openai-compatible provider`,
        );
      }
      if (!apiKey) {
        throw new Error(
          `${purpose.toUpperCase()}_API_KEY is required for openai-compatible provider`,
        );
      }
      const { ChatOpenAI } = await import("@langchain/openai");
      return new ChatOpenAI({
        modelName: model,
        configuration: { baseURL },
        apiKey,
        ...(temperature != null && { temperature }),
      });
    }

    default:
      throw new Error(
        `Unsupported LLM provider: "${provider}". Supported providers: openai, anthropic, google-genai, ollama, openai-compatible`,
      );
  }
}

// ============================================================================
// createEmbeddings
// ============================================================================

/**
 * Create an Embeddings instance based on EMBEDDING_* environment variables.
 *
 *   EMBEDDING_PROVIDER    (default: openai)
 *   EMBEDDING_MODEL       (default: text-embedding-3-small)
 *   EMBEDDING_DIMENSIONS  (default: 1536)
 *
 * For `openai-compatible` mode, `EMBEDDING_BASE_URL` and `EMBEDDING_API_KEY`
 * are required.
 */
export async function createEmbeddings(
  options: EmbeddingOptions = {},
): Promise<Embeddings> {
  const { provider, model, dimensions: envDimensions, baseURL, apiKey } =
    readEmbeddingConfig();
  const dimensions = options.dimensions ?? envDimensions;

  switch (provider) {
    case "openai": {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(
          "OPENAI_API_KEY environment variable is required for openai provider",
        );
      }
      const { OpenAIEmbeddings } = await import("@langchain/openai");
      return new OpenAIEmbeddings({
        modelName: model,
        dimensions,
      });
    }

    case "ollama": {
      const { OllamaEmbeddings } = await import("@langchain/ollama");
      return new OllamaEmbeddings({
        model,
      });
    }

    case "google-genai": {
      if (!process.env.GOOGLE_API_KEY) {
        throw new Error(
          "GOOGLE_API_KEY environment variable is required for google-genai provider",
        );
      }
      const { GoogleGenerativeAIEmbeddings } =
        await import("@langchain/google-genai");
      return new GoogleGenerativeAIEmbeddings({
        modelName: model,
      });
    }

    case "openai-compatible": {
      if (!baseURL) {
        throw new Error(
          "EMBEDDING_BASE_URL is required for openai-compatible provider",
        );
      }
      if (!apiKey) {
        throw new Error(
          "EMBEDDING_API_KEY is required for openai-compatible provider",
        );
      }
      const { OpenAIEmbeddings } = await import("@langchain/openai");
      return new OpenAIEmbeddings({
        modelName: model,
        dimensions,
        configuration: { baseURL },
        apiKey,
      });
    }

    default:
      throw new Error(
        `Unsupported embedding provider: "${provider}". Supported providers: openai, ollama, google-genai, openai-compatible`,
      );
  }
}

// ============================================================================
// StructuredOutputError
// ============================================================================

/**
 * Error thrown when json_prompt mode fails to parse LLM output.
 * Includes the raw LLM output for debugging.
 */
export class StructuredOutputError extends Error {
  public readonly llmOutput: string;

  constructor(message: string, llmOutput: string) {
    super(message);
    this.name = "StructuredOutputError";
    this.llmOutput = llmOutput;
  }
}

// ============================================================================
// Structured output mode helpers
// ============================================================================

export type StructuredOutputMode = "auto" | "native" | "json_prompt";

/** Providers that support native withStructuredOutput */
const NATIVE_STRUCTURED_PROVIDERS = new Set<LLMProvider>([
  "openai",
  "anthropic",
  "google-genai",
]);

/**
 * Resolve the structured output strategy for a given purpose.
 */
function resolveStructuredOutputMode(
  purpose: LLMPurpose,
  provider: LLMProvider,
): "native" | "json_prompt" {
  const prefix = purpose.toUpperCase();
  const envValue = (
    process.env[`${prefix}_STRUCTURED_OUTPUT`] ?? "auto"
  ).toLowerCase() as StructuredOutputMode;

  if (envValue === "native") return "native";
  if (envValue === "json_prompt") return "json_prompt";

  // auto: decide based on provider
  return NATIVE_STRUCTURED_PROVIDERS.has(provider) ? "native" : "json_prompt";
}

// ============================================================================
// createStructuredModel
// ============================================================================

/**
 * Create a Runnable that produces structured (typed) output for the given
 * purpose and Zod schema.
 *
 * The strategy is controlled by `{PURPOSE}_STRUCTURED_OUTPUT` env var:
 *   - `auto`  (default) — openai/anthropic/google-genai use native;
 *                          ollama/openai-compatible use json_prompt
 *   - `native`          — always use `llm.withStructuredOutput(schema)`
 *   - `json_prompt`     — append JSON schema instructions to the prompt,
 *                          then parse + validate with Zod
 */
export async function createStructuredModel<T extends z.ZodType>(
  purpose: LLMPurpose,
  schema: T,
  options?: { name?: string; temperature?: number },
): Promise<Runnable<unknown, z.infer<T>>> {
  const { provider } = readPurposeConfig(purpose);
  const mode = resolveStructuredOutputMode(purpose, provider);
  const llm = await createChatModel(purpose, {
    temperature: options?.temperature,
  });

  if (mode === "native") {
    return llm.withStructuredOutput(schema, {
      name: options?.name ?? "structured_output",
    }) as Runnable<unknown, z.infer<T>>;
  }

  // json_prompt mode: wrap the LLM in a RunnableLambda that appends JSON
  // schema instructions and parses the output.
  const jsonSchema = toJsonSchema(schema);
  const schemaStr = JSON.stringify(jsonSchema, null, 2);

  const jsonPromptInstruction = [
    "\n\n---",
    "You MUST respond with valid JSON that conforms to the following JSON Schema:",
    "```json",
    schemaStr,
    "```",
    "Output ONLY the JSON object, no additional text or markdown fences.",
  ].join("\n");

  return new RunnableLambda({
    func: async (input: unknown) => {
      // Coerce input to string so we can append the instruction
      let prompt: string;
      if (typeof input === "string") {
        prompt = input;
      } else if (
        Array.isArray(input) &&
        input.length > 0 &&
        typeof input[0] === "object" &&
        input[0] !== null &&
        "content" in input[0]
      ) {
        // BaseMessage[] — append instruction to the last message content
        const messages = input.map((msg, idx) => {
          if (idx === input.length - 1) {
            return { ...msg, content: String(msg.content) + jsonPromptInstruction };
          }
          return msg;
        });
        const result = await llm.invoke(messages);
        const raw = typeof result.content === "string"
          ? result.content
          : JSON.stringify(result.content);
        return parseJsonOutput(raw, schema);
      } else if (
        typeof input === "object" &&
        input !== null &&
        "toString" in input
      ) {
        prompt = String(input);
      } else {
        prompt = String(input);
      }

      const fullPrompt = prompt + jsonPromptInstruction;
      const result = await llm.invoke(fullPrompt);
      const raw = typeof result.content === "string"
        ? result.content
        : JSON.stringify(result.content);
      return parseJsonOutput(raw, schema);
    },
  });
}

/**
 * Parse raw LLM text output as JSON and validate against a Zod schema.
 * Throws StructuredOutputError on failure.
 */
function parseJsonOutput<T extends z.ZodType>(
  raw: string,
  schema: T,
): z.infer<T> {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new StructuredOutputError(
      `Failed to parse LLM output as JSON: ${cleaned.slice(0, 200)}`,
      raw,
    );
  }

  try {
    return schema.parse(parsed);
  } catch (err) {
    throw new StructuredOutputError(
      `LLM output JSON does not match schema: ${err instanceof Error ? err.message : String(err)}`,
      raw,
    );
  }
}
