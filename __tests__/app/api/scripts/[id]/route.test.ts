import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks – declared before importing the module under test
// ---------------------------------------------------------------------------

const mockSelectScripts = vi.fn();
const mockSelectDocuments = vi.fn();
const mockEqScripts = vi.fn();
const mockEqDocuments = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();

vi.mock("../../../../../lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "scripts") {
        return {
          select: mockSelectScripts,
        };
      }
      if (table === "documents") {
        return {
          select: mockSelectDocuments,
        };
      }
      return {};
    }),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET } from "../../../../../app/api/scripts/[id]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createGetRequest(id: string) {
  const request = new Request(`http://localhost/api/scripts/${id}`, {
    method: "GET",
  });
  const params = Promise.resolve({ id });
  return { request, params };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/scripts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default chain: select → eq → single
    mockSelectScripts.mockReturnValue({ eq: mockEqScripts });
    mockEqScripts.mockReturnValue({ single: mockSingle });
    // Default chain: select → eq → order
    mockSelectDocuments.mockReturnValue({ eq: mockEqDocuments });
    mockEqDocuments.mockReturnValue({ order: mockOrder });
  });

  it("returns script details with associated documents", async () => {
    const script = {
      id: "s1",
      name: "测试剧本",
      description: "描述",
      created_at: "2024-01-01T00:00:00Z",
    };
    const documents = [
      {
        id: "d1",
        filename: "主持人手册.pdf",
        status: "completed",
        page_count: 10,
        created_at: "2024-01-02T00:00:00Z",
      },
      {
        id: "d2",
        filename: "玩家剧本.pdf",
        status: "processing",
        page_count: null,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    mockSingle.mockResolvedValue({ data: script, error: null });
    mockOrder.mockResolvedValue({ data: documents, error: null });

    const { request, params } = createGetRequest("s1");
    const res = await GET(request as any, { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("s1");
    expect(body.name).toBe("测试剧本");
    expect(body.description).toBe("描述");
    expect(body.documents).toHaveLength(2);
    expect(body.documents[0].filename).toBe("主持人手册.pdf");
    expect(body.documents[1].filename).toBe("玩家剧本.pdf");
  });

  it("returns script with empty documents array when no documents exist", async () => {
    const script = {
      id: "s2",
      name: "空剧本",
      description: null,
      created_at: "2024-01-01T00:00:00Z",
    };

    mockSingle.mockResolvedValue({ data: script, error: null });
    mockOrder.mockResolvedValue({ data: [], error: null });

    const { request, params } = createGetRequest("s2");
    const res = await GET(request as any, { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("空剧本");
    expect(body.description).toBeNull();
    expect(body.documents).toEqual([]);
  });

  // --- 404 SCRIPT_NOT_FOUND ---

  it("returns 404 SCRIPT_NOT_FOUND when script does not exist", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows found" },
    });

    const { request, params } = createGetRequest("nonexistent-id");
    const res = await GET(request as any, { params });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe("SCRIPT_NOT_FOUND");
  });

  // --- 500 INTERNAL_ERROR ---

  it("returns 500 INTERNAL_ERROR when scripts query fails", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "OTHER", message: "Connection timeout" },
    });

    const { request, params } = createGetRequest("s1");
    const res = await GET(request as any, { params });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 INTERNAL_ERROR when documents query fails", async () => {
    const script = {
      id: "s1",
      name: "剧本",
      description: null,
      created_at: "2024-01-01T00:00:00Z",
    };

    mockSingle.mockResolvedValue({ data: script, error: null });
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: "Query failed" },
    });

    const { request, params } = createGetRequest("s1");
    const res = await GET(request as any, { params });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});
