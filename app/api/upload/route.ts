import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ingestionGraph } from "@/lib/workflows/ingestion/graph";
import { extractionGraph } from "@/lib/workflows/extraction/graph";

/** Maximum file size: 50 MB */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** PDF magic bytes: %PDF */
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]);

/**
 * POST /api/upload
 *
 * Accepts a PDF file via multipart/form-data, stores it in Supabase Storage,
 * and triggers the Ingestion Pipeline.
 *
 * Returns the document ID and processing status.
 *
 * Requirements: 1.1, 1.5, 1.6
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const scriptId = formData.get("script_id");
    const scriptIdStr = typeof scriptId === "string" && scriptId.trim() ? scriptId.trim() : undefined;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "未提供文件", code: "MISSING_FILE" },
        { status: 400 },
      );
    }

    // --- Requirement 1.5: reject non-PDF files ---
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        {
          error: `文件格式不受支持：${file.name} 不是 PDF 文件`,
          code: "INVALID_FILE_TYPE",
        },
        { status: 400 },
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "文件过大，请分割文档后重新上传（最大 50MB）",
          code: "FILE_TOO_LARGE",
        },
        { status: 413 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate PDF magic bytes (Requirement 1.5)
    if (buffer.length < 4 || !buffer.subarray(0, 4).equals(PDF_MAGIC)) {
      return NextResponse.json(
        {
          error: `文件格式不受支持：${file.name} 不是有效的 PDF 文件`,
          code: "INVALID_FILE_TYPE",
        },
        { status: 400 },
      );
    }

    // --- Store in Supabase Storage ---
    const storagePath = `uploads/${Date.now()}_${file.name}`;
    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (storageError) {
      return NextResponse.json(
        {
          error: "文件上传至存储服务失败，请稍后重试",
          code: "STORAGE_ERROR",
          details: storageError.message,
        },
        { status: 503 },
      );
    }

    // --- Trigger Ingestion Pipeline ---
    // The pipeline creates the document record, parses, chunks, and embeds.
    // Errors from the pipeline (e.g. empty PDF content per Requirement 1.6)
    // are caught below and returned with appropriate status codes.
    const result = await ingestionGraph.invoke({
      pdfBuffer: buffer,
      filename: file.name,
      scriptId: scriptIdStr,
    });

    // --- Trigger Extraction Pipeline after Ingestion completes ---
    // The extraction pipeline reads the document chunks created by ingestion
    // and extracts structured data (characters, tricks, metadata, etc.)
    // Requirements: 1.1, 15.1
    let extractionStatus: "completed" | "extraction_failed" = "completed";
    let extractionError: string | undefined;
    try {
      await extractionGraph.invoke({
        documentId: result.documentId,
        scriptId: scriptIdStr,
      });
    } catch (err: unknown) {
      // Extraction failure should not fail the upload — the document is
      // already ingested and searchable via semantic search.
      extractionStatus = "extraction_failed";
      extractionError =
        err instanceof Error ? err.message : "Extraction failed";
      console.error(
        `[upload] Extraction pipeline failed for document ${result.documentId}:`,
        err,
      );
    }

    return NextResponse.json(
      {
        documentId: result.documentId,
        status: extractionStatus,
        extractionStatus,
        ...(extractionError && { extractionError }),
        filename: file.name,
        pageCount: result.pageCount,
        chunkCount: result.chunkIds?.length ?? 0,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "未知错误";

    // Requirement 1.6: empty / unparseable PDF content
    if (message.includes("文档内容无法解析")) {
      return NextResponse.json(
        { error: message, code: "EMPTY_CONTENT" },
        { status: 422 },
      );
    }

    // Requirement 1.5: invalid PDF (caught by parsePdf)
    if (message.includes("文件格式不受支持")) {
      return NextResponse.json(
        { error: message, code: "INVALID_FILE_TYPE" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: message, code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
