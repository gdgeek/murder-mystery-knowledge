import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks – declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock("../../../../lib/services/document", () => ({
  getChunksByDocumentId: vi.fn().mockResolvedValue([
    { id: "chunk-1", content: "第一幕：密室杀人案" },
    { id: "chunk-2", content: "角色：侦探张三" },
  ]),
  updateDocumentStatus: vi.fn().mockResolvedValue({}),
  getDocument: vi.fn().mockResolvedValue({ id: "doc-123", script_id: "script-abc" }),
}));

// Use vi.hoisted to create mock functions that can be referenced in vi.mock
const { mockExtractors, mockEvaluateConfidence, mockStoreResults } = vi.hoisted(() => {
  const types = [
    "trick", "character", "script_structure", "story_background",
    "script_format", "player_script", "clue", "reasoning_chain",
    "misdirection", "script_metadata", "game_mechanics",
    "narrative_technique", "emotional_design",
  ];

  const defaultResult = {
    data: { name: "test", review_status: "approved" },
    confidence: { name: 0.9 },
    review_status: "approved" as const,
  };

  const extractors: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const t of types) {
    extractors[t] = vi.fn().mockResolvedValue(defaultResult);
  }

  return {
    mockExtractors: extractors,
    mockEvaluateConfidence: vi.fn().mockImplementation(
      (input: Record<string, unknown>) => ({
        ...input,
        review_status: "approved",
      }),
    ),
    mockStoreResults: vi.fn().mockResolvedValue([
      { entityType: "trick", record: { id: "rec-1" } },
    ]),
  };
});

vi.mock("../../../../lib/workflows/extraction/prompts", () => ({
  extractorRegistry: mockExtractors,
}));

vi.mock("../../../../lib/workflows/extraction/confidence", () => ({
  evaluateConfidence: mockEvaluateConfidence,
}));

vi.mock("../../../../lib/workflows/extraction/nodes/store-results", () => ({
  storeExtractionResults: mockStoreResults,
}));

vi.mock("../../../../lib/supabase", () => ({
  supabase: {},
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  extractionGraph,
  ExtractionState,
} from "../../../../lib/workflows/extraction/graph";
import {
  getChunksByDocumentId,
  getDocument,
  updateDocumentStatus,
} from "../../../../lib/services/document";

const entityTypes = [
  "trick", "character", "script_structure", "story_background",
  "script_format", "player_script", "clue", "reasoning_chain",
  "misdirection", "script_metadata", "game_mechanics",
  "narrative_technique", "emotional_design",
];

describe("Extraction Pipeline Graph", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mock implementations
    const defaultResult = {
      data: { name: "test", review_status: "approved" },
      confidence: { name: 0.9 },
      review_status: "approved" as const,
    };
    for (const t of entityTypes) {
      mockExtractors[t].mockResolvedValue(defaultResult);
    }
    mockStoreResults.mockResolvedValue([
      { entityType: "trick", record: { id: "rec-1" } },
    ]);
    mockEvaluateConfidence.mockImplementation(
      (input: Record<string, unknown>) => ({
        ...input,
        review_status: "approved",
      }),
    );
  });

  // --- Graph structure ---

  it("exports a compiled graph", () => {
    expect(extractionGraph).toBeDefined();
    expect(typeof extractionGraph.invoke).toBe("function");
  });

  it("exports the ExtractionState annotation", () => {
    expect(ExtractionState).toBeDefined();
    expect(ExtractionState.spec).toBeDefined();
  });

  // --- Full pipeline invocation ---

  it("runs the full pipeline and returns final state", async () => {
    const result = await extractionGraph.invoke({
      documentId: "doc-123",
    });

    expect(result.documentId).toBe("doc-123");
    expect(result.chunks).toHaveLength(2);
    expect(result.extractionResults).toBeDefined();
    expect(result.extractionResults.length).toBeGreaterThan(0);
    expect(result.storedRecords).toBeDefined();
  });

  // --- loadChunks node ---

  it("updates document status to 'extracting' at start", async () => {
    await extractionGraph.invoke({ documentId: "doc-123" });

    expect(updateDocumentStatus).toHaveBeenCalledWith("doc-123", "extracting");
  });

  it("fetches chunks by document ID", async () => {
    await extractionGraph.invoke({ documentId: "doc-123" });

    expect(getChunksByDocumentId).toHaveBeenCalledWith("doc-123");
  });

  // --- extractAll node ---

  it("calls all 13 extractors for each chunk", async () => {
    await extractionGraph.invoke({ documentId: "doc-123" });

    // 2 chunks × 13 entity types = 26 total calls
    const totalCalls = entityTypes.reduce(
      (sum, t) => sum + mockExtractors[t].mock.calls.length,
      0,
    );
    expect(totalCalls).toBe(26);
  });

  it("passes chunk content to each extractor", async () => {
    await extractionGraph.invoke({ documentId: "doc-123" });

    for (const t of entityTypes) {
      const calls = mockExtractors[t].mock.calls.map(
        (c: unknown[]) => c[0],
      );
      expect(calls).toContain("第一幕：密室杀人案");
      expect(calls).toContain("角色：侦探张三");
    }
  });

  it("continues extraction when individual extractors fail", async () => {
    mockExtractors["trick"].mockRejectedValue(new Error("LLM timeout"));

    const result = await extractionGraph.invoke({ documentId: "doc-123" });

    // Should still have results from the other 12 extractors × 2 chunks = 24
    expect(result.extractionResults.length).toBe(24);
  });

  // --- evaluateAll node ---

  it("applies confidence evaluation to all results", async () => {
    await extractionGraph.invoke({ documentId: "doc-123" });

    // evaluateConfidence should be called once per extraction result
    expect(mockEvaluateConfidence).toHaveBeenCalled();
    expect(mockEvaluateConfidence.mock.calls.length).toBe(26);
  });

  // --- storeAll node ---

  it("calls storeExtractionResults with all results", async () => {
    await extractionGraph.invoke({ documentId: "doc-123" });

    expect(mockStoreResults).toHaveBeenCalledTimes(1);
    const storeArgs = mockStoreResults.mock.calls[0][0];
    expect(storeArgs).toHaveLength(26);

    for (const input of storeArgs) {
      expect(input).toHaveProperty("entityType");
      expect(input).toHaveProperty("data");
      expect(input).toHaveProperty("documentId", "doc-123");
      expect(input).toHaveProperty("chunkId");
      expect(input).toHaveProperty("scriptId", "script-abc");
    }
  });

  // --- scriptId propagation ---

  it("looks up script_id from document record in loadChunks", async () => {
    const result = await extractionGraph.invoke({ documentId: "doc-123" });

    expect(getDocument).toHaveBeenCalledWith("doc-123");
    expect(result.scriptId).toBe("script-abc");
  });

  it("sets scriptId to null when document has no script_id", async () => {
    vi.mocked(getDocument).mockResolvedValueOnce({ id: "doc-123", script_id: null });

    const result = await extractionGraph.invoke({ documentId: "doc-123" });

    expect(result.scriptId).toBeNull();
  });

  it("sets scriptId to null when getDocument fails", async () => {
    vi.mocked(getDocument).mockRejectedValueOnce(new Error("not found"));

    const result = await extractionGraph.invoke({ documentId: "doc-123" });

    expect(result.scriptId).toBeNull();
  });

  it("passes scriptId to storeExtractionResults when document has no script", async () => {
    vi.mocked(getDocument).mockResolvedValueOnce({ id: "doc-123", script_id: null });

    await extractionGraph.invoke({ documentId: "doc-123" });

    const storeArgs = mockStoreResults.mock.calls[0][0];
    for (const input of storeArgs) {
      expect(input.scriptId).toBeNull();
    }
  });

  // --- Error propagation ---

  it("propagates loadChunks errors", async () => {
    vi.mocked(getChunksByDocumentId).mockRejectedValueOnce(
      new Error("DB connection failed"),
    );

    await expect(
      extractionGraph.invoke({ documentId: "doc-bad" }),
    ).rejects.toThrow("DB connection failed");
  });

  it("propagates storeAll errors", async () => {
    mockStoreResults.mockRejectedValueOnce(new Error("Storage failure"));

    await expect(
      extractionGraph.invoke({ documentId: "doc-123" }),
    ).rejects.toThrow("Storage failure");
  });

  // --- Edge case: no chunks ---

  it("handles documents with no chunks gracefully", async () => {
    vi.mocked(getChunksByDocumentId).mockResolvedValueOnce([]);

    const result = await extractionGraph.invoke({ documentId: "doc-empty" });

    expect(result.chunks).toHaveLength(0);
    expect(result.extractionResults).toHaveLength(0);
  });
});
