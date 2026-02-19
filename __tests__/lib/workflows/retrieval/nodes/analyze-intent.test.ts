import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks – declared before importing the module under test
// ---------------------------------------------------------------------------

let mockChainResult: unknown = {};

// Mock lib/ai/provider – createStructuredModel returns a mock Runnable
vi.mock("../../../../../lib/ai/provider", () => ({
  createStructuredModel: vi.fn().mockResolvedValue({
    // The Runnable returned by createStructuredModel is used as the
    // second half of `prompt.pipe(structuredLlm)`, so the prompt mock's
    // pipe().invoke() drives the actual invocation.
  }),
}));

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
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------

import {
  analyzeIntent,
  IntentAnalysisResultSchema,
  type IntentAnalysisResult,
} from "../../../../../lib/workflows/retrieval/nodes/analyze-intent";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyzeIntent", () => {
  beforeEach(() => {
    mockChainResult = {};
    vi.clearAllMocks();
  });

  it("classifies a structured query with filters", async () => {
    mockChainResult = {
      queryType: "structured",
      structuredFilters: {
        entity_type: "trick",
        type: "locked_room",
      },
      semanticQuery: undefined,
    } satisfies IntentAnalysisResult;

    const result = await analyzeIntent("找所有密室诡计");

    expect(result.queryType).toBe("structured");
    expect(result.structuredFilters).toEqual({
      entity_type: "trick",
      type: "locked_room",
    });
    expect(result.semanticQuery).toBeUndefined();
  });

  it("classifies a semantic query", async () => {
    mockChainResult = {
      queryType: "semantic",
      structuredFilters: undefined,
      semanticQuery: "如何设计一个好的推理链",
    } satisfies IntentAnalysisResult;

    const result = await analyzeIntent("如何设计一个好的推理链");

    expect(result.queryType).toBe("semantic");
    expect(result.structuredFilters).toBeUndefined();
    expect(result.semanticQuery).toBe("如何设计一个好的推理链");
  });

  it("classifies a hybrid query with both filters and semantic portion", async () => {
    mockChainResult = {
      queryType: "hybrid",
      structuredFilters: {
        entity_type: "trick",
        type: "locked_room",
      },
      semanticQuery: "最巧妙的机关设计是什么",
    } satisfies IntentAnalysisResult;

    const result = await analyzeIntent("密室诡计中最巧妙的机关设计是什么");

    expect(result.queryType).toBe("hybrid");
    expect(result.structuredFilters).toBeDefined();
    expect(result.structuredFilters?.entity_type).toBe("trick");
    expect(result.semanticQuery).toBe("最巧妙的机关设计是什么");
  });

  it("extracts character role filters", async () => {
    mockChainResult = {
      queryType: "structured",
      structuredFilters: {
        entity_type: "character",
        role: "detective",
      },
    } satisfies IntentAnalysisResult;

    const result = await analyzeIntent("列出所有侦探角色");

    expect(result.queryType).toBe("structured");
    expect(result.structuredFilters?.entity_type).toBe("character");
    expect(result.structuredFilters?.role).toBe("detective");
  });

  it("extracts difficulty and player count filters", async () => {
    mockChainResult = {
      queryType: "structured",
      structuredFilters: {
        entity_type: "script_metadata",
        difficulty: "hardcore",
        min_players: 6,
      },
    } satisfies IntentAnalysisResult;

    const result = await analyzeIntent("适合6人以上的硬核剧本");

    expect(result.queryType).toBe("structured");
    expect(result.structuredFilters?.difficulty).toBe("hardcore");
    expect(result.structuredFilters?.min_players).toBe(6);
  });

  it("extracts era filter for story background queries", async () => {
    mockChainResult = {
      queryType: "hybrid",
      structuredFilters: {
        entity_type: "story_background",
        era: "民国",
      },
      semanticQuery: "独特的叙事手法",
    } satisfies IntentAnalysisResult;

    const result = await analyzeIntent("民国时代的剧本有哪些独特的叙事手法");

    expect(result.queryType).toBe("hybrid");
    expect(result.structuredFilters?.era).toBe("民国");
    expect(result.semanticQuery).toBe("独特的叙事手法");
  });

  it("result passes Zod schema validation", async () => {
    mockChainResult = {
      queryType: "structured",
      structuredFilters: {
        entity_type: "game_mechanics",
        core_gameplay_type: "推理投凶",
      },
    };

    const result = await analyzeIntent("推理投凶类型的游戏机制");
    const parsed = IntentAnalysisResultSchema.safeParse(result);

    expect(parsed.success).toBe(true);
  });

  it("accepts custom model options", async () => {
    mockChainResult = {
      queryType: "semantic",
      semanticQuery: "test query",
    };

    const result = await analyzeIntent("test query", {
      temperature: 0.2,
    });

    expect(result.queryType).toBe("semantic");
  });
});
