import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks – declared before importing the module under test
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockNot = vi.fn();

vi.mock("../../../../lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "scripts") {
        return {
          insert: mockInsert,
          select: mockSelect,
        };
      }
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnValue({
            not: mockNot,
          }),
        };
      }
      return {};
    }),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST, GET } from "../../../../app/api/scripts/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createPostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/scripts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createGetRequest(): Request {
  return new Request("http://localhost/api/scripts", { method: "GET" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/scripts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
  });

  it("creates a script with valid name and returns 201", async () => {
    const scriptData = {
      id: "script-123",
      name: "测试剧本",
      description: null,
      created_at: "2024-01-01T00:00:00Z",
    };
    mockSingle.mockResolvedValue({ data: scriptData, error: null });

    const req = createPostRequest({ name: "测试剧本" });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe("script-123");
    expect(body.name).toBe("测试剧本");
    expect(body.description).toBeNull();
  });

  it("creates a script with name and description", async () => {
    const scriptData = {
      id: "script-456",
      name: "完整剧本",
      description: "一个有描述的剧本",
      created_at: "2024-01-01T00:00:00Z",
    };
    mockSingle.mockResolvedValue({ data: scriptData, error: null });

    const req = createPostRequest({
      name: "完整剧本",
      description: "一个有描述的剧本",
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.name).toBe("完整剧本");
    expect(body.description).toBe("一个有描述的剧本");
  });

  it("trims whitespace from name before inserting", async () => {
    const scriptData = {
      id: "script-789",
      name: "带空格的名称",
      description: null,
      created_at: "2024-01-01T00:00:00Z",
    };
    mockSingle.mockResolvedValue({ data: scriptData, error: null });

    const req = createPostRequest({ name: "  带空格的名称  " });
    await POST(req as any);

    expect(mockInsert).toHaveBeenCalledWith({
      name: "带空格的名称",
      description: null,
    });
  });

  // --- Requirement 1.4: empty name validation ---

  it("returns 400 INVALID_NAME when name is empty string", async () => {
    const req = createPostRequest({ name: "" });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_NAME");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_NAME when name is whitespace only", async () => {
    const req = createPostRequest({ name: "   " });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_NAME");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_NAME when name is missing", async () => {
    const req = createPostRequest({});
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_NAME");
  });

  it("returns 400 INVALID_NAME when name is not a string", async () => {
    const req = createPostRequest({ name: 123 });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_NAME");
  });

  // --- Database error ---

  it("returns 500 INTERNAL_ERROR when database insert fails", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Database connection failed" },
    });

    const req = createPostRequest({ name: "测试" });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});

describe("GET /api/scripts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns script list with document counts", async () => {
    const scripts = [
      {
        id: "s1",
        name: "剧本A",
        description: null,
        created_at: "2024-01-02T00:00:00Z",
      },
      {
        id: "s2",
        name: "剧本B",
        description: "描述B",
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    mockSelect.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockResolvedValue({ data: scripts, error: null });

    // Documents with script_id
    mockNot.mockResolvedValue({
      data: [
        { script_id: "s1" },
        { script_id: "s1" },
        { script_id: "s2" },
      ],
      error: null,
    });

    const req = createGetRequest();
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].name).toBe("剧本A");
    expect(body.items[0].document_count).toBe(2);
    expect(body.items[1].name).toBe("剧本B");
    expect(body.items[1].document_count).toBe(1);
  });

  it("returns empty list when no scripts exist", async () => {
    mockSelect.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockNot.mockResolvedValue({ data: [], error: null });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(0);
    expect(body.items).toEqual([]);
  });

  it("returns 0 document_count for scripts with no documents", async () => {
    mockSelect.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockResolvedValue({
      data: [
        { id: "s1", name: "空剧本", description: null, created_at: "2024-01-01T00:00:00Z" },
      ],
      error: null,
    });
    mockNot.mockResolvedValue({ data: [], error: null });

    const res = await GET();
    const body = await res.json();

    expect(body.items[0].document_count).toBe(0);
  });

  // --- Database error ---

  it("returns 500 INTERNAL_ERROR when scripts query fails", async () => {
    mockSelect.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: "Connection timeout" },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 INTERNAL_ERROR when document count query fails", async () => {
    mockSelect.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockResolvedValue({
      data: [{ id: "s1", name: "剧本", description: null, created_at: "2024-01-01T00:00:00Z" }],
      error: null,
    });
    mockNot.mockResolvedValue({
      data: null,
      error: { message: "Query failed" },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});
