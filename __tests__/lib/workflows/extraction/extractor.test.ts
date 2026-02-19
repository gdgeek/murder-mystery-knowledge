import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks – must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Capture the structured output result that the mock chain will return
let mockChainResult: unknown = {};

// Mock lib/ai/provider – createStructuredModel returns a mock Runnable
vi.mock("../../../../lib/ai/provider", () => ({
  createStructuredModel: vi.fn().mockResolvedValue({
    // The Runnable returned by createStructuredModel is used as the
    // second half of `prompt.pipe(structuredLlm)`, so it doesn't need
    // invoke itself here – the prompt mock's pipe().invoke() drives it.
  }),
}));

// Mock @langchain/core/prompts – the prompt template returns a chain-like
// object whose `.pipe()` returns an invokable chain.
vi.mock("@langchain/core/prompts", () => ({
  ChatPromptTemplate: {
    fromMessages: vi.fn().mockReturnValue({
      pipe: vi.fn().mockReturnValue({
        invoke: vi.fn().mockImplementation(async () => mockChainResult),
      }),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import {
  extractStructuredData,
  createExtractor,
  type ExtractionResult,
} from "../../../../lib/workflows/extraction/extractor";
import { TrickSchema, CharacterSchema, StoryBackgroundSchema } from "../../../../lib/schemas";


// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extractStructuredData", () => {
  beforeEach(() => {
    mockChainResult = {};
    vi.clearAllMocks();
  });

  it("returns extracted data validated against the schema with high confidence", async () => {
    mockChainResult = {
      name: "密室诡计",
      type: "locked_room",
      mechanism: "通过暗门进出密室",
      key_elements: ["暗门", "时间差"],
      weakness: "暗门有磨损痕迹",
      confidence: { name: 0.95, type: 0.9, mechanism: 0.85, weakness: 0.8 },
      review_status: "approved",
    };

    const result = await extractStructuredData(
      TrickSchema,
      "Extract trick information from the following murder mystery script text.",
      "这是一个密室杀人案，凶手通过暗门进出密室...",
    );

    expect(result.data).toBeDefined();
    expect(result.confidence).toEqual({
      name: 0.95,
      type: 0.9,
      mechanism: 0.85,
      weakness: 0.8,
    });
    expect(result.review_status).toBe("approved");

    // Validate the data passes the Zod schema
    const parsed = TrickSchema.safeParse(result.data);
    expect(parsed.success).toBe(true);
  });

  it("marks review_status as pending_review when any confidence is below 0.7", async () => {
    mockChainResult = {
      name: "角色A",
      role: "suspect",
      motivation: "不明",
      personality_traits: ["神秘"],
      relationships: [],
      confidence: { name: 0.9, role: 0.5, motivation: 0.3 },
      review_status: "pending_review",
    };

    const result = await extractStructuredData(
      CharacterSchema,
      "Extract character information.",
      "角色A是一个神秘的嫌疑人...",
    );

    expect(result.review_status).toBe("pending_review");
    expect(result.confidence.role).toBe(0.5);
    expect(result.confidence.motivation).toBe(0.3);
  });

  it("handles missing confidence field gracefully", async () => {
    mockChainResult = {
      era: "民国",
      location: "上海",
      worldview: "乱世",
      social_environment: "租界时期",
      // No confidence field returned by LLM
    };

    const result = await extractStructuredData(
      StoryBackgroundSchema,
      "Extract story background.",
      "故事发生在民国时期的上海租界...",
    );

    // When confidence is missing, should default to pending_review
    expect(result.review_status).toBe("pending_review");
    expect(result.confidence).toEqual({});
  });

  it("overrides LLM review_status with computed value", async () => {
    // LLM says "approved" but confidence has a low score
    mockChainResult = {
      name: "诡计X",
      type: "other",
      mechanism: "未知",
      key_elements: [],
      weakness: null,
      confidence: { name: 0.9, type: 0.4 },
      review_status: "approved", // LLM incorrectly says approved
    };

    const result = await extractStructuredData(
      TrickSchema,
      "Extract trick information.",
      "一些文本...",
    );

    // Our logic should override to pending_review because type confidence is 0.4
    expect(result.review_status).toBe("pending_review");
    expect(result.data.review_status).toBe("pending_review");
  });

  it("accepts custom extractor options", async () => {
    mockChainResult = {
      era: "现代",
      location: "北京",
      confidence: { era: 0.8, location: 0.9 },
      review_status: "approved",
    };

    const result = await extractStructuredData(
      StoryBackgroundSchema,
      "Extract story background.",
      "现代北京的故事...",
      { temperature: 0.2 },
    );

    expect(result.data).toBeDefined();
    expect(result.review_status).toBe("approved");
  });
});

describe("createExtractor", () => {
  beforeEach(() => {
    mockChainResult = {};
    vi.clearAllMocks();
  });

  it("returns a reusable function bound to schema and prompt", async () => {
    mockChainResult = {
      name: "毒杀诡计",
      type: "poisoning",
      mechanism: "在酒中下毒",
      key_elements: ["毒药", "酒杯"],
      weakness: "毒药有特殊气味",
      confidence: { name: 0.95, type: 0.9, mechanism: 0.85 },
      review_status: "approved",
    };

    const extractTrick = createExtractor(
      TrickSchema,
      "Extract trick information from the text.",
    );

    const result = await extractTrick("凶手在酒中下了毒...");

    expect(result.data).toBeDefined();
    expect(result.review_status).toBe("approved");
    expect(result.confidence.name).toBe(0.95);
  });
});
