import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks – declared before importing the module under test
// ---------------------------------------------------------------------------

const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockReturnValue({ upload: mockUpload });

vi.mock("../../../../lib/supabase", () => ({
  supabase: {
    storage: {
      from: (...args: unknown[]) => mockFrom(...args),
    },
  },
}));

const mockInvoke = vi.fn();
vi.mock("../../../../lib/workflows/ingestion/graph", () => ({
  ingestionGraph: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
  },
}));

const mockExtractionInvoke = vi.fn().mockResolvedValue({
  storedRecords: [],
});
vi.mock("../../../../lib/workflows/extraction/graph", () => ({
  extractionGraph: {
    invoke: (...args: unknown[]) => mockExtractionInvoke(...args),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST } from "../../../../app/api/upload/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** PDF magic bytes followed by minimal content */
const PDF_HEADER = Buffer.from("%PDF-1.4 fake content");

function createFormData(file: File): FormData {
  const fd = new FormData();
  fd.append("file", file);
  return fd;
}

function createPdfFile(name = "test.pdf", content?: Buffer): File {
  const buf = content ?? PDF_HEADER;
  return new File([buf], name, { type: "application/pdf" });
}

function createRequest(formData: FormData): Request {
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: formData,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({
      documentId: "doc-123",
      pageCount: 5,
      chunkIds: ["c1", "c2", "c3"],
    });
    mockExtractionInvoke.mockResolvedValue({
      storedRecords: [],
    });
  });

  // --- Happy path ---

  it("uploads a valid PDF and returns document info", async () => {
    const file = createPdfFile();
    const req = createRequest(createFormData(file));

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.documentId).toBe("doc-123");
    expect(body.status).toBe("completed");
    expect(body.extractionStatus).toBe("completed");
    expect(body.filename).toBe("test.pdf");
    expect(body.pageCount).toBe(5);
    expect(body.chunkCount).toBe(3);
  });

  it("stores the file in Supabase Storage before invoking the pipeline", async () => {
    const file = createPdfFile();
    const req = createRequest(createFormData(file));

    await POST(req as any);

    expect(mockFrom).toHaveBeenCalledWith("documents");
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining("uploads/"),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "application/pdf" }),
    );
  });

  it("invokes the ingestion pipeline with the PDF buffer and filename", async () => {
    const file = createPdfFile("script.pdf");
    const req = createRequest(createFormData(file));

    await POST(req as any);

    expect(mockInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        pdfBuffer: expect.any(Buffer),
        filename: "script.pdf",
      }),
    );
  });

  // --- script_id handling ---

  it("passes script_id to ingestion and extraction pipelines when provided", async () => {
    const file = createPdfFile();
    const fd = new FormData();
    fd.append("file", file);
    fd.append("script_id", "script-abc");
    const req = createRequest(fd);

    await POST(req as any);

    expect(mockInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ scriptId: "script-abc" }),
    );
    expect(mockExtractionInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ scriptId: "script-abc" }),
    );
  });

  it("does not pass scriptId when script_id is not in FormData", async () => {
    const file = createPdfFile();
    const req = createRequest(createFormData(file));

    await POST(req as any);

    expect(mockInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ scriptId: undefined }),
    );
    expect(mockExtractionInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ scriptId: undefined }),
    );
  });

  it("ignores empty script_id values", async () => {
    const file = createPdfFile();
    const fd = new FormData();
    fd.append("file", file);
    fd.append("script_id", "  ");
    const req = createRequest(fd);

    await POST(req as any);

    expect(mockInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ scriptId: undefined }),
    );
  });

  // --- Requirement 1.5: non-PDF rejection ---

  it("rejects files without .pdf extension (400)", async () => {
    const file = new File([PDF_HEADER], "document.txt", {
      type: "text/plain",
    });
    const req = createRequest(createFormData(file));

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_FILE_TYPE");
    expect(body.error).toContain("文件格式不受支持");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("rejects files with .pdf extension but invalid magic bytes (400)", async () => {
    const fakePdf = Buffer.from("This is not a PDF");
    const file = createPdfFile("fake.pdf", fakePdf);
    const req = createRequest(createFormData(file));

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_FILE_TYPE");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  // --- Requirement 1.6: empty content ---

  it("returns 422 when PDF content is empty", async () => {
    mockInvoke.mockRejectedValueOnce(
      new Error("文档内容无法解析：test.pdf 的 PDF 内容为空或无法提取文本"),
    );

    const file = createPdfFile();
    const req = createRequest(createFormData(file));

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.code).toBe("EMPTY_CONTENT");
    expect(body.error).toContain("文档内容无法解析");
  });

  // --- Missing file ---

  it("returns 400 when no file is provided", async () => {
    const fd = new FormData();
    const req = createRequest(fd);

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_FILE");
  });

  // --- Storage failure ---

  it("returns 503 when Supabase Storage upload fails", async () => {
    mockUpload.mockResolvedValueOnce({
      error: { message: "Storage quota exceeded" },
    });

    const file = createPdfFile();
    const req = createRequest(createFormData(file));

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe("STORAGE_ERROR");
  });

  // --- Pipeline error propagation ---

  it("returns 400 when pipeline throws invalid PDF error", async () => {
    mockInvoke.mockRejectedValueOnce(
      new Error("文件格式不受支持：test.pdf 不是有效的 PDF 文件"),
    );

    const file = createPdfFile();
    const req = createRequest(createFormData(file));

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_FILE_TYPE");
  });

  it("returns 500 for unexpected errors", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Unexpected failure"));

    const file = createPdfFile();
    const req = createRequest(createFormData(file));

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  // --- Integration: Ingestion → Extraction chaining ---

  it("triggers extraction pipeline after ingestion completes", async () => {
    const file = createPdfFile();
    const req = createRequest(createFormData(file));

    await POST(req as any);

    expect(mockExtractionInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: "doc-123" }),
    );
  });

  it("calls extraction after ingestion (order check)", async () => {
    const callOrder: string[] = [];
    mockInvoke.mockImplementation(async () => {
      callOrder.push("ingestion");
      return { documentId: "doc-123", pageCount: 5, chunkIds: ["c1"] };
    });
    mockExtractionInvoke.mockImplementation(async () => {
      callOrder.push("extraction");
      return { storedRecords: [] };
    });

    const file = createPdfFile();
    const req = createRequest(createFormData(file));

    await POST(req as any);

    expect(callOrder).toEqual(["ingestion", "extraction"]);
  });

  it("returns 200 with extraction_failed status when extraction fails", async () => {
    mockExtractionInvoke.mockRejectedValueOnce(
      new Error("LLM API timeout"),
    );

    const file = createPdfFile();
    const req = createRequest(createFormData(file));

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.documentId).toBe("doc-123");
    expect(body.extractionStatus).toBe("extraction_failed");
    expect(body.extractionError).toBe("LLM API timeout");
    expect(body.chunkCount).toBe(3);
  });

  it("does not trigger extraction when ingestion fails", async () => {
    mockInvoke.mockRejectedValueOnce(
      new Error("文档内容无法解析：test.pdf 的 PDF 内容为空"),
    );

    const file = createPdfFile();
    const req = createRequest(createFormData(file));

    await POST(req as any);

    expect(mockExtractionInvoke).not.toHaveBeenCalled();
  });
});
