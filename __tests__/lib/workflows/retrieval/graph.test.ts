import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks – declared before importing the module under test
// ---------------------------------------------------------------------------

const { mockAnalyzeIntent, mockStructuredSearch, mockSemanticSearch, mockMergeResults, mockGenerateAnswer, mockGetSessionHistory, mockFormatEmpty, mockIsOutOfScope } = vi.hoisted(() => ({
  mockAnalyzeIntent: vi.fn(),
  mockStructuredSearch: vi.fn(),
  mockSemanticSearch: vi.fn(),
  mockMergeResults: vi.fn(),
  mockGenerateAnswer: vi.fn(),
  mockGetSessionHistory: vi.fn(),
  mockFormatEmpty: vi.fn(),
  mockIsOutOfScope: vi.fn(),
}));

vi.mock("../../../../lib/workflows/retrieval/nodes/analyze-intent", () => ({
  analyzeIntent: mockAnalyzeIntent,
}));

vi.mock("../../../../lib/workflows/retrieval/nodes/structured-search", () => ({
  performStructuredSearch: mockStructuredSearch,
}));

vi.mock("../../../../lib/workflows/retrieval/nodes/semantic-search", () => ({
  performSemanticSearch: mockSemanticSearch,
}));

vi.mock("../../../../lib/workflows/retrieval/nodes/merge-results", () => ({
  mergeSearchResults: mockMergeResults,
}));

vi.mock("../../../../lib/workflows/retrieval/nodes/generate-answer", () => ({
  generateAnswer: mockGenerateAnswer,
}));

vi.mock("../../../../lib/services/chat", () => ({
  getSessionHistory: mockGetSessionHistory,
}));

vi.mock("../../../../lib/workflows/retrieval/empty-results", () => ({
  formatEmptyResultsResponse: mockFormatEmpty,
  isOutOfScope: mockIsOutOfScope,
}));

vi.mock("../../../../lib/supabase", () => ({
  supabase: {},
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  retrievalGraph,
  RetrievalState,
} from "../../../../lib/workflows/retrieval/graph";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeSearchResult(id: string, docName = "剧本A") {
  return {
    id,
    type: "trick",
    data: { name: "密室诡计" },
    source: { document_name: docName, page_start: 1, page_end: 3 },
    score: 0.9,
  };
}

const defaultIntentResult = {
  queryType: "semantic" as const,
  semanticQuery: "如何设计密室诡计",
};

const defaultMergedResults = [makeSearchResult("r-1"), makeSearchResult("r-2")];

const defaultAnswer = {
  answer: "密室诡计的设计要点包括... [来源: 剧本A, 页码 1-3]",
  sources: [{ document_name: "剧本A", page_start: 1, page_end: 3 }],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Retrieval Pipeline Graph", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockAnalyzeIntent.mockResolvedValue(defaultIntentResult);
    mockStructuredSearch.mockResolvedValue([]);
    mockSemanticSearch.mockResolvedValue(defaultMergedResults);
    mockMergeResults.mockReturnValue(defaultMergedResults);
    mockGenerateAnswer.mockResolvedValue(defaultAnswer);
    mockGetSessionHistory.mockResolvedValue([]);
    mockFormatEmpty.mockReturnValue("没有找到相关信息。");
    mockIsOutOfScope.mockReturnValue(false);
  });

  // --- Graph structure ---

  it("exports a compiled graph", () => {
    expect(retrievalGraph).toBeDefined();
    expect(typeof retrievalGraph.invoke).toBe("function");
  });

  it("exports the RetrievalState annotation", () => {
    expect(RetrievalState).toBeDefined();
    expect(RetrievalState.spec).toBeDefined();
  });

  // --- Full pipeline ---

  it("runs the full pipeline and returns answer with sources", async () => {
    const result = await retrievalGraph.invoke({
      query: "如何设计密室诡计",
    });

    expect(result.query).toBe("如何设计密室诡计");
    expect(result.answer).toBe(defaultAnswer.answer);
    expect(result.sources).toEqual(defaultAnswer.sources);
    expect(result.mergedResults).toEqual(defaultMergedResults);
  });

  // --- analyzeIntent node ---

  it("calls analyzeIntent with the user query", async () => {
    await retrievalGraph.invoke({ query: "找所有密室诡计" });

    expect(mockAnalyzeIntent).toHaveBeenCalledWith("找所有密室诡计");
  });

  // --- routeAndSearch node: semantic ---

  it("calls only semantic search for semantic queries", async () => {
    mockAnalyzeIntent.mockResolvedValue({
      queryType: "semantic",
      semanticQuery: "推理链设计",
    });

    await retrievalGraph.invoke({ query: "推理链设计" });

    expect(mockSemanticSearch).toHaveBeenCalledWith("推理链设计");
    expect(mockStructuredSearch).not.toHaveBeenCalled();
  });

  // --- routeAndSearch node: structured ---

  it("calls only structured search for structured queries", async () => {
    const intentResult = {
      queryType: "structured" as const,
      structuredFilters: { entity_type: "trick" as const, type: "locked_room" },
    };
    mockAnalyzeIntent.mockResolvedValue(intentResult);

    await retrievalGraph.invoke({ query: "找所有密室诡计" });

    expect(mockStructuredSearch).toHaveBeenCalledWith({
      structuredFilters: intentResult.structuredFilters,
    });
    expect(mockSemanticSearch).not.toHaveBeenCalled();
  });

  // --- routeAndSearch node: hybrid ---

  it("calls both searches for hybrid queries", async () => {
    const intentResult = {
      queryType: "hybrid" as const,
      structuredFilters: { entity_type: "trick" as const, type: "locked_room" },
      semanticQuery: "巧妙的机关设计",
    };
    mockAnalyzeIntent.mockResolvedValue(intentResult);

    await retrievalGraph.invoke({ query: "密室诡计中最巧妙的机关设计" });

    expect(mockStructuredSearch).toHaveBeenCalledWith({
      structuredFilters: intentResult.structuredFilters,
    });
    expect(mockSemanticSearch).toHaveBeenCalledWith("巧妙的机关设计");
  });

  // --- merge node ---

  it("merges structured and semantic results", async () => {
    const structured = [makeSearchResult("s-1")];
    const semantic = [makeSearchResult("s-2")];
    mockAnalyzeIntent.mockResolvedValue({
      queryType: "hybrid",
      structuredFilters: { entity_type: "trick" as const },
      semanticQuery: "test",
    });
    mockStructuredSearch.mockResolvedValue(structured);
    mockSemanticSearch.mockResolvedValue(semantic);
    mockMergeResults.mockReturnValue([...structured, ...semantic]);

    await retrievalGraph.invoke({ query: "test" });

    expect(mockMergeResults).toHaveBeenCalledWith(structured, semantic);
  });

  // --- generate node ---

  it("calls generateAnswer with query, merged results, and no history", async () => {
    await retrievalGraph.invoke({ query: "如何设计密室诡计" });

    expect(mockGenerateAnswer).toHaveBeenCalledWith(
      "如何设计密室诡计",
      defaultMergedResults,
      undefined,
    );
  });

  it("loads chat history when sessionId is provided", async () => {
    const mockHistory = [{ content: "previous message" }];
    mockGetSessionHistory.mockResolvedValue(mockHistory);

    await retrievalGraph.invoke({
      query: "继续上面的话题",
      sessionId: "session-123",
    });

    expect(mockGetSessionHistory).toHaveBeenCalledWith("session-123");
    expect(mockGenerateAnswer).toHaveBeenCalledWith(
      "继续上面的话题",
      defaultMergedResults,
      mockHistory,
    );
  });

  it("does not load chat history when sessionId is not provided", async () => {
    await retrievalGraph.invoke({ query: "test query" });

    expect(mockGetSessionHistory).not.toHaveBeenCalled();
  });

  // --- empty results handling ---

  it("returns empty results message when no search results found", async () => {
    mockMergeResults.mockReturnValue([]);

    const result = await retrievalGraph.invoke({ query: "不存在的内容" });

    expect(mockFormatEmpty).toHaveBeenCalledWith("不存在的内容");
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
    expect(result.answer).toBe("没有找到相关信息。");
    expect(result.sources).toEqual([]);
  });

  // --- error propagation ---

  it("propagates analyzeIntent errors", async () => {
    mockAnalyzeIntent.mockRejectedValueOnce(new Error("LLM API error"));

    await expect(
      retrievalGraph.invoke({ query: "test" }),
    ).rejects.toThrow("LLM API error");
  });

  it("propagates search errors", async () => {
    mockSemanticSearch.mockRejectedValueOnce(new Error("Embedding failed"));

    await expect(
      retrievalGraph.invoke({ query: "test" }),
    ).rejects.toThrow("Embedding failed");
  });

  it("propagates generateAnswer errors", async () => {
    mockGenerateAnswer.mockRejectedValueOnce(new Error("Generation timeout"));

    await expect(
      retrievalGraph.invoke({ query: "test" }),
    ).rejects.toThrow("Generation timeout");
  });

  // --- fallback: uses query when semanticQuery is missing ---

  it("falls back to original query when semanticQuery is undefined", async () => {
    mockAnalyzeIntent.mockResolvedValue({
      queryType: "semantic",
    });

    await retrievalGraph.invoke({ query: "原始查询" });

    expect(mockSemanticSearch).toHaveBeenCalledWith("原始查询");
  });
});
