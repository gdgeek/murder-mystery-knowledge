import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { z } from "zod";
import { computeReviewStatus } from "../../services/utils";
import { createStructuredModel } from "../../ai/provider";

// ============================================================================
// Types
// ============================================================================

export interface ExtractionResult<T> {
  /** Extracted data validated against the Zod schema */
  data: T;
  /** Per-field confidence scores (0-1) */
  confidence: Record<string, number>;
  /** Computed review status based on confidence threshold */
  review_status: "approved" | "pending_review";
}

export interface ExtractorOptions {
  /** Temperature for LLM. Defaults to 0 for deterministic extraction. */
  temperature?: number;
}

// ============================================================================
// Default prompt template
// ============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are a structured data extraction assistant for murder mystery (剧本杀) scripts.
Your task is to extract structured information from the provided text according to the given schema.

IMPORTANT RULES:
1. Extract ONLY information that is explicitly present or strongly implied in the text.
2. For each field you extract, provide a confidence score between 0 and 1:
   - 1.0 = information is explicitly stated in the text
   - 0.7-0.9 = information is strongly implied
   - 0.4-0.6 = information is weakly implied or partially present
   - 0.1-0.3 = information is guessed with low confidence
   - Use null/empty for fields where no relevant information exists
3. Return the extracted data in the exact format specified by the schema.
4. The "confidence" field should be a JSON object mapping field names to their confidence scores.
5. Set "review_status" to "pending_review" if any field has confidence below 0.7, otherwise "approved".`;

// ============================================================================
// Core extraction function
// ============================================================================

/**
 * Generic structured data extraction using LLM with Zod schema binding.
 *
 * Accepts any Zod schema, sends the text through a structured LLM model
 * created via the provider factory, and returns validated data + confidence scores.
 */
export async function extractStructuredData<T extends z.ZodType>(
  schema: T,
  promptTemplate: string,
  text: string,
  options: ExtractorOptions = {},
): Promise<ExtractionResult<z.infer<T>>> {
  const { temperature = 0 } = options;

  const structuredLlm = await createStructuredModel("extraction", schema, {
    name: "extract_structured_data",
    temperature,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", DEFAULT_SYSTEM_PROMPT],
    ["human", `${promptTemplate}\n\n---\nText to extract from:\n{text}`],
  ]);

  const chain = prompt.pipe(structuredLlm);

  const result = (await chain.invoke({ text })) as Record<string, unknown>;

  // Extract confidence and compute review status
  const confidence: Record<string, number> =
    result?.confidence as Record<string, number> ?? {};

  const review_status = computeReviewStatus(confidence);

  return {
    data: { ...result, review_status } as z.infer<T>,
    confidence,
    review_status,
  };
}

/**
 * Create a reusable extractor bound to a specific schema and prompt.
 * Useful when the same entity type needs to be extracted from many chunks.
 */
export function createExtractor<T extends z.ZodType>(
  schema: T,
  promptTemplate: string,
  options: ExtractorOptions = {},
) {
  return (text: string) =>
    extractStructuredData(schema, promptTemplate, text, options);
}
