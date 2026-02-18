import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks – must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock("../../../../lib/services/document", () => ({
  createDocument: vi.fn().mockResolvedValue({ id: "doc-1" }),
  updateDocumentStatus: vi.fn().mockResolvedValue({}),
  createChunks: vi.fn().mockResolvedValue([
    { id: "chunk-1", content: "text-a" },
    { id: "chunk-2", content: "text-b" },
  ]),
  getChunksByDocumentId: vi.fn().mockResolvedValue([
    { id: "chunk-1", content: "text-a" },
    { id: "chunk-2", content: "text-b" },
  ]),
}));

vi.mock("../../../../lib/workflows/ingestion/nodes/parse-pdf", () => ({
  parsePdf: vi.fn().mockResolvedValue({
    text: "Extracted text from PDF",
    pageCount: 3,
    filename: "test.pdf",
  }),
}));

vi.mock("../../../../lib/workflows/ingestion/nodes/chunk-text", () => ({
  chunkText: vi.fn().mockResolvedValue({
    filename: "test.pdf",
    chunks: [
      { content: "text-a", page_start: 1, page_end: 1, chunk_index: 0 },
      { content: "text-b", page_start: 2, page_end: 3, chunk_index: 1 },
    ],
  }),
}));

vi.mock("../../../../lib/workflows/ingestion/nodes/embed-chunks", () => ({
  embedChunks: vi.fn().mockResolvedValue({
    processedIds: ["chunk-1", "chunk-2"],
  }),
}));

// Prevent Supabase client from throwing on missing env vars
vi.mock("../../../../lib/supabase", () => ({
  supabase: {},
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ingestionGraph, IngestionState } from "../../../../lib/workflows/ingestion/graph";
import { parsePdf } from "../../../../lib/workflows/ingestion/nodes/parse-pdf";
import { chunkText } from "../../../../lib/workflows/ingestion/nodes/chunk-text";
import { embedChunks } from "../../../../lib/workflows/ingestion/nodes/embed-chunks";
import {
  createDocument,
  updateDocumentStatus,
  createChunks,
  getChunksByDocumentId,
} from "../../../../lib/services/document";

describe("Ingestion Pipeline Graph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Graph structure ---

  it("exports a compiled graph", () => {
    expect(ingestionGraph).toBeDefined();
    expect(typeof ingestionGraph.invoke).toBe("function");
  });

  it("exports the IngestionState annotation", () => {
    expect(IngestionState).toBeDefined();
    expect(IngestionState.spec).toBeDefined();
  });

  // --- Full pipeline invocation (mocked) ---

  it("runs the full pipeline and returns final state", async () => {
    const result = await ingestionGraph.invoke({
      pdfBuffer: Buffer.from("fake-pdf"),
      filename: "test.pdf",
    });

    expect(result.documentId).toBe("doc-1");
    expect(result.text).toBe("Extracted text from PDF");
    expect(result.pageCount).toBe(3);
    expect(result.chunkIds).toEqual(["chunk-1", "chunk-2"]);
    expect(result.processedIds).toEqual(["chunk-1", "chunk-2"]);
  });

  // --- Node invocation order ---

  it("calls parsePdf with the input buffer and filename", async () => {
    const buf = Buffer.from("pdf-content");
    await ingestionGraph.invoke({ pdfBuffer: buf, filename: "my.pdf" });

    expect(parsePdf).toHaveBeenCalledWith(buf, "my.pdf");
  });

  it("calls chunkText with extracted text, filename, and pageCount", async () => {
    await ingestionGraph.invoke({
      pdfBuffer: Buffer.from("x"),
      filename: "doc.pdf",
    });

    expect(chunkText).toHaveBeenCalledWith(
      "Extracted text from PDF",
      "doc.pdf",
      3,
    );
  });

  it("calls embedChunks with chunk id/content pairs", async () => {
    await ingestionGraph.invoke({
      pdfBuffer: Buffer.from("x"),
      filename: "doc.pdf",
    });

    expect(embedChunks).toHaveBeenCalledWith([
      { id: "chunk-1", content: "text-a" },
      { id: "chunk-2", content: "text-b" },
    ]);
  });

  // --- Document status transitions ---

  it("creates a document record during parsePdf step", async () => {
    await ingestionGraph.invoke({
      pdfBuffer: Buffer.from("x"),
      filename: "test.pdf",
    });

    expect(createDocument).toHaveBeenCalledWith("test.pdf", "", undefined);
  });

  it("updates document status through the expected lifecycle", async () => {
    await ingestionGraph.invoke({
      pdfBuffer: Buffer.from("x"),
      filename: "test.pdf",
    });

    const statusCalls = vi.mocked(updateDocumentStatus).mock.calls.map(
      (call) => call[1],
    );

    expect(statusCalls).toContain("parsing");
    expect(statusCalls).toContain("chunking");
    expect(statusCalls).toContain("embedding");
    expect(statusCalls).toContain("completed");
  });

  // --- DB interactions ---

  it("persists chunks via createChunks", async () => {
    await ingestionGraph.invoke({
      pdfBuffer: Buffer.from("x"),
      filename: "test.pdf",
    });

    expect(createChunks).toHaveBeenCalledWith("doc-1", expect.any(Array));
  });

  it("fetches chunks by document ID before embedding", async () => {
    await ingestionGraph.invoke({
      pdfBuffer: Buffer.from("x"),
      filename: "test.pdf",
    });

    expect(getChunksByDocumentId).toHaveBeenCalledWith("doc-1");
  });

  // --- Error propagation ---

  it("propagates parsePdf errors", async () => {
    vi.mocked(parsePdf).mockRejectedValueOnce(
      new Error("文件格式不受支持"),
    );

    await expect(
      ingestionGraph.invoke({
        pdfBuffer: Buffer.from("bad"),
        filename: "bad.txt",
      }),
    ).rejects.toThrow("文件格式不受支持");
  });

  it("propagates embedding errors", async () => {
    vi.mocked(embedChunks).mockRejectedValueOnce(
      new Error("OpenAI API error"),
    );

    await expect(
      ingestionGraph.invoke({
        pdfBuffer: Buffer.from("x"),
        filename: "test.pdf",
      }),
    ).rejects.toThrow("OpenAI API error");
  });
});
