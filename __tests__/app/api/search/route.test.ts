import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks – declared before importing the module under test
// ---------------------------------------------------------------------------

const mockPerformStructuredSearch = vi.fn();
const mockPerformSemanticSearch = vi.fn();
const mockMergeSearchResults = vi.fn();

vi.mock("../../../../lib/workflows/retrieval/nodes/structured-search", () => ({
  performStructuredSearch: (...args: unknown[]) =>
    mockPerformStructuredSearch(...args),
}));

vi.mock("../../../../lib/workflows/retrieval/nodes/semantic-search", () => ({
  performSemanticSearch: (...args: unknown[]) =>
    mockPerformSemanticSearch(...args),
}));

vi.mock("../../../../lib/workflows/retrieval/nodes/merge-results", () => ({
  mergeSearchResults: (...args: unknown[]) => mockMergeSearchResults(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST, mapFiltersToIntent } from "../../../../app/api/search/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const sampleStructuredResult = {
  id: "trick-1",
  type: "trick",
  data: { name: "密室诡计A", type: "locked_room" },
  source: { document_name: "script1.pdf", page_start: 5, page_end: 8 },
  score: 0.9,
};

const sampleSemanticResult = {
  id: "chunk-1",
  type: "document_chunk",
  data: { content: "关于密室设计的描述..." },
  source: { document_name: "script2.pdf", page_start: 12, page_end: 14 },
  score: 0.85,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformStructuredSearch.mockResolvedValue([sampleStructuredResult]);
    mockPerformSemanticSearch.mockResolvedValue([sampleSemanticResult]);
    mockMergeSearchResults.mockReturnValue([
      sampleStructuredResult,
      sampleSemanticResult,
    ]);
  });

  // --- Structured search only ---

  it("executes structured search when only filters are provided", async () => {
    const req = createRequest({
      filters: { trick_type: "locked_room" },
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].type).toBe("trick");
    expect(body.total).toBe(1);

    expect(mockPerformStructuredSearch).toHaveBeenCalledWith({
      structuredFilters: expect.objectContaining({
        entity_type: "trick",
        type: "locked_room",
      }),
    });
    expect(mockPerformSemanticSearch).not.toHaveBeenCalled();
    expect(mockMergeSearchResults).not.toHaveBeenCalled();
  });

  // --- Semantic search only ---

  it("executes semantic search when only query is provided", async () => {
    const req = createRequest({ query: "如何设计密室诡计" });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].type).toBe("document_chunk");
    expect(body.total).toBe(1);

    expect(mockPerformSemanticSearch).toHaveBeenCalledWith("如何设计密室诡计");
    expect(mockPerformStructuredSearch).not.toHaveBeenCalled();
    expect(mockMergeSearchResults).not.toHaveBeenCalled();
  });

  // --- Hybrid search ---

  it("executes hybrid search when both query and filters are provided", async () => {
    const req = createRequest({
      query: "巧妙的机关设计",
      filters: { trick_type: "locked_room" },
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);

    expect(mockPerformStructuredSearch).toHaveBeenCalled();
    expect(mockPerformSemanticSearch).toHaveBeenCalledWith("巧妙的机关设计");
    expect(mockMergeSearchResults).toHaveBeenCalledWith(
      [sampleStructuredResult],
      [sampleSemanticResult],
    );
  });

  // --- Result format ---

  it("returns items with type, data, source, and score fields", async () => {
    const req = createRequest({ query: "test" });
    const res = await POST(req as any);
    const body = await res.json();

    const item = body.items[0];
    expect(item).toHaveProperty("type");
    expect(item).toHaveProperty("data");
    expect(item).toHaveProperty("source");
    expect(item).toHaveProperty("score");
    expect(typeof item.score).toBe("number");
    expect(item.source).toHaveProperty("document_name");
  });

  // --- Empty results (Requirement 12.5) ---

  it("returns empty results with suggestion message when no matches found", async () => {
    mockPerformSemanticSearch.mockResolvedValueOnce([]);

    const req = createRequest({ query: "不存在的内容" });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.message).toContain("未找到匹配的结果");
  });

  // --- Validation errors ---

  it("returns 400 when neither query nor filters are provided", async () => {
    const req = createRequest({});
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_QUERY");
  });

  it("returns 400 when query is empty string and no filters", async () => {
    const req = createRequest({ query: "" });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_QUERY");
  });

  it("returns 400 when query is whitespace only and no filters", async () => {
    const req = createRequest({ query: "   " });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_QUERY");
  });

  it("returns 400 when filters is an empty object and no query", async () => {
    const req = createRequest({ filters: {} });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_QUERY");
  });

  // --- Query trimming ---

  it("trims whitespace from query before searching", async () => {
    const req = createRequest({ query: "  密室诡计  " });
    await POST(req as any);

    expect(mockPerformSemanticSearch).toHaveBeenCalledWith("密室诡计");
  });

  // --- Error handling ---

  it("returns 500 when structured search fails", async () => {
    mockPerformStructuredSearch.mockRejectedValueOnce(
      new Error("Database connection failed"),
    );

    const req = createRequest({ filters: { trick_type: "locked_room" } });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.error).toContain("Database connection failed");
  });

  it("returns 500 when semantic search fails", async () => {
    mockPerformSemanticSearch.mockRejectedValueOnce(
      new Error("Embedding API error"),
    );

    const req = createRequest({ query: "test query" });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});

// ---------------------------------------------------------------------------
// mapFiltersToIntent unit tests
// ---------------------------------------------------------------------------

describe("mapFiltersToIntent", () => {
  it("maps trick_type to entity_type trick", () => {
    const result = mapFiltersToIntent({ trick_type: "locked_room" });
    expect(result).toEqual({ entity_type: "trick", type: "locked_room" });
  });

  it("maps character_identity to entity_type character", () => {
    const result = mapFiltersToIntent({ character_identity: "murderer" });
    expect(result).toEqual({ entity_type: "character", role: "murderer" });
  });

  it("maps era to entity_type story_background", () => {
    const result = mapFiltersToIntent({ era: "民国" });
    expect(result).toEqual({ entity_type: "story_background", era: "民国" });
  });

  it("maps act_count to entity_type script_format", () => {
    const result = mapFiltersToIntent({ act_count: 3 });
    expect(result).toEqual({ entity_type: "script_format", act_count: 3 });
  });

  it("maps clue_type to entity_type clue", () => {
    const result = mapFiltersToIntent({ clue_type: "physical_evidence" });
    expect(result).toEqual({ entity_type: "clue", type: "physical_evidence" });
  });

  it("maps misdirection_type to entity_type misdirection", () => {
    const result = mapFiltersToIntent({ misdirection_type: "false_clue" });
    expect(result).toEqual({ entity_type: "misdirection", type: "false_clue" });
  });

  it("maps play_type to entity_type game_mechanics", () => {
    const result = mapFiltersToIntent({ play_type: "推理投凶" });
    expect(result).toEqual({
      entity_type: "game_mechanics",
      core_gameplay_type: "推理投凶",
    });
  });

  it("maps narrative_structure_type to entity_type narrative_technique", () => {
    const result = mapFiltersToIntent({
      narrative_structure_type: "nonlinear",
    });
    expect(result).toEqual({
      entity_type: "narrative_technique",
      structure_type: "nonlinear",
    });
  });

  it("maps player_count to entity_type script_metadata with min/max", () => {
    const result = mapFiltersToIntent({ player_count: 6 });
    expect(result).toEqual({
      entity_type: "script_metadata",
      min_players: 6,
      max_players: 6,
    });
  });

  it("uses first filter's entity_type when multiple filters are provided", () => {
    const result = mapFiltersToIntent({
      trick_type: "locked_room",
      era: "民国",
    });
    // trick_type is processed first, so entity_type = "trick"
    expect(result.entity_type).toBe("trick");
    expect(result.type).toBe("locked_room");
    expect(result.era).toBe("民国");
  });

  it("returns empty object when no filters match", () => {
    const result = mapFiltersToIntent({});
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// script_id filter tests (Task 7.4)
// ---------------------------------------------------------------------------

describe("mapFiltersToIntent – script_id", () => {
  it("passes script_id through to mapped filters", () => {
    const result = mapFiltersToIntent({
      script_id: "abc-123",
      trick_type: "locked_room",
    });
    expect(result).toEqual({
      script_id: "abc-123",
      entity_type: "trick",
      type: "locked_room",
    });
  });

  it("passes script_id even without entity-specific filters", () => {
    const result = mapFiltersToIntent({ script_id: "abc-123" });
    expect(result).toEqual({ script_id: "abc-123" });
  });

  it("omits script_id when not provided", () => {
    const result = mapFiltersToIntent({ trick_type: "locked_room" });
    expect(result).not.toHaveProperty("script_id");
  });
});

