import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks – declared before importing the module under test
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockFromDocuments = vi.fn();
const mockFromChunks = vi.fn();

vi.mock("../../../../lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "documents") return mockFromDocuments();
      if (table === "document_chunks") return mockFromChunks();
      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET } from "../../../../app/api/documents/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost:3000/api/documents");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString());
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleDocuments = [
  {
    id: "doc-1",
    filename: "script_a.pdf",
    status: "completed",
    page_count: 42,
    created_at: "2024-01-15T10:00:00Z",
    script_id: "script-1",
    scripts: { id: "script-1", name: "迷雾庄园" },
  },
  {
    id: "doc-2",
    filename: "script_b.pdf",
    status: "parsing",
    page_count: null,
    created_at: "2024-01-14T08:30:00Z",
    script_id: null,
    scripts: null,
  },
];

const sampleChunks = [
  { document_id: "doc-1" },
  { document_id: "doc-1" },
  { document_id: "doc-1" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: documents query chain
    mockOrder.mockReturnValue({ data: sampleDocuments, error: null });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockFromDocuments.mockReturnValue({ select: mockSelect });

    // Default: chunks query
    mockFromChunks.mockReturnValue({
      select: vi.fn().mockReturnValue({ data: sampleChunks, error: null }),
    });
  });

  // --- Happy path ---

  it("returns a list of documents with processing status", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it("includes all required fields for each document", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    const doc = body.items[0];
    expect(doc).toHaveProperty("id", "doc-1");
    expect(doc).toHaveProperty("filename", "script_a.pdf");
    expect(doc).toHaveProperty("status", "completed");
    expect(doc).toHaveProperty("upload_date", "2024-01-15T10:00:00Z");
    expect(doc).toHaveProperty("page_count", 42);
    expect(doc).toHaveProperty("chunk_count", 3);
  });

  it("maps created_at to upload_date in the response", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.items[0].upload_date).toBe("2024-01-15T10:00:00Z");
    expect(body.items[0]).not.toHaveProperty("created_at");
  });

  it("returns chunk_count of 0 for documents with no chunks", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    const doc2 = body.items.find((d: any) => d.id === "doc-2");
    expect(doc2.chunk_count).toBe(0);
  });

  // --- Empty list ---

  it("returns empty items when no documents exist", async () => {
    mockOrder.mockReturnValue({ data: [], error: null });
    mockFromChunks.mockReturnValue({
      select: vi.fn().mockReturnValue({ data: [], error: null }),
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  // --- Null page_count ---

  it("handles documents with null page_count", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    const doc2 = body.items.find((d: any) => d.id === "doc-2");
    expect(doc2.page_count).toBeNull();
  });

  // --- Error handling ---

  it("returns 500 when documents query fails", async () => {
    mockOrder.mockReturnValue({
      data: null,
      error: { message: "Database connection failed" },
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 when chunk count query fails", async () => {
    mockFromChunks.mockReturnValue({
      select: vi.fn().mockReturnValue({
        data: null,
        error: { message: "Chunk query failed" },
      }),
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  // --- Queries correct tables ---

  it("queries the documents table with correct select and order", async () => {
    await GET(makeRequest());

    expect(mockFromDocuments).toHaveBeenCalled();
    expect(mockSelect).toHaveBeenCalledWith(
      "id, filename, status, page_count, created_at, script_id, scripts(id, name)",
    );
    expect(mockOrder).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("queries document_chunks for chunk counts", async () => {
    await GET(makeRequest());

    expect(mockFromChunks).toHaveBeenCalled();
  });

  // --- Script name in document list (Req 2.4) ---

  it("includes script_name for documents associated with a script", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    const doc1 = body.items.find((d: any) => d.id === "doc-1");
    expect(doc1.script_name).toBe("迷雾庄园");
    expect(doc1.script_id).toBe("script-1");
  });

  it("returns null script_name for documents without a script", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    const doc2 = body.items.find((d: any) => d.id === "doc-2");
    expect(doc2.script_name).toBeNull();
    expect(doc2.script_id).toBeNull();
  });

  // --- Filter by script_id (Req 2.5) ---

  describe("script_id filtering", () => {
    it("applies eq filter when script_id param is provided", async () => {
      mockEq.mockReturnValue({ data: [sampleDocuments[0]], error: null });
      mockOrder.mockReturnValue({ eq: mockEq });

      const res = await GET(makeRequest({ script_id: "script-1" }));
      const body = await res.json();

      expect(mockEq).toHaveBeenCalledWith("script_id", "script-1");
      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].id).toBe("doc-1");
    });

    it("does not apply eq filter when script_id param is absent", async () => {
      await GET(makeRequest());

      expect(mockEq).not.toHaveBeenCalled();
    });
  });

  // --- Group by script (Req 7.1, 7.2, 7.3) ---

  describe("group_by_script", () => {
    it("returns grouped response when group_by_script=true", async () => {
      const res = await GET(makeRequest({ group_by_script: "true" }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveProperty("groups");
      expect(body).toHaveProperty("total", 2);
      expect(body).not.toHaveProperty("items");
    });

    it("groups documents by script with correct structure", async () => {
      const res = await GET(makeRequest({ group_by_script: "true" }));
      const body = await res.json();

      // Should have 2 groups: one for script-1, one for null (ungrouped)
      expect(body.groups).toHaveLength(2);

      const scriptGroup = body.groups.find((g: any) => g.script !== null);
      expect(scriptGroup.script).toEqual({ id: "script-1", name: "迷雾庄园" });
      expect(scriptGroup.documents).toHaveLength(1);
      expect(scriptGroup.documents[0].id).toBe("doc-1");

      const ungrouped = body.groups.find((g: any) => g.script === null);
      expect(ungrouped.documents).toHaveLength(1);
      expect(ungrouped.documents[0].id).toBe("doc-2");
    });

    it("returns flat list when group_by_script is not true", async () => {
      const res = await GET(makeRequest({ group_by_script: "false" }));
      const body = await res.json();

      expect(body).toHaveProperty("items");
      expect(body).not.toHaveProperty("groups");
    });

    it("returns flat list when group_by_script is absent", async () => {
      const res = await GET(makeRequest());
      const body = await res.json();

      expect(body).toHaveProperty("items");
      expect(body).not.toHaveProperty("groups");
    });
  });
});
