import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/documents
 *
 * Returns the list of uploaded documents with their processing status.
 * Each document includes: id, filename, status, upload_date, page_count, chunk_count.
 *
 * Query parameters:
 *   script_id?: string — filter documents by script
 *   group_by_script?: "true" — group documents by script
 *
 * Requirements: 2.4, 2.5, 7.1, 7.2, 7.3, 14.2
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scriptId = searchParams.get("script_id");
    const groupByScript = searchParams.get("group_by_script") === "true";

    // Build documents query with script join
    let query = supabase
      .from("documents")
      .select("id, filename, status, page_count, created_at, script_id, scripts(id, name)")
      .order("created_at", { ascending: false });

    // Filter by script_id when provided
    if (scriptId) {
      query = query.eq("script_id", scriptId);
    }

    const { data: documents, error } = await query;

    if (error) throw error;

    // Fetch chunk counts per document in a single query
    const { data: chunkCounts, error: chunkError } = await supabase
      .from("document_chunks")
      .select("document_id");

    if (chunkError) throw chunkError;

    // Build a map of document_id → chunk count
    const countMap = new Map<string, number>();
    for (const row of chunkCounts ?? []) {
      const docId = row.document_id as string;
      countMap.set(docId, (countMap.get(docId) ?? 0) + 1);
    }

    const docItems = (documents ?? []).map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      status: doc.status,
      upload_date: doc.created_at,
      page_count: doc.page_count,
      chunk_count: countMap.get(doc.id) ?? 0,
      script_id: doc.script_id ?? null,
      script_name: doc.scripts
        ? (doc.scripts as unknown as { id: string; name: string }).name
        : null,
    }));

    // Return grouped response when requested
    if (groupByScript) {
      const groupMap = new Map<string | null, typeof docItems>();

      for (const doc of docItems) {
        const key = doc.script_id;
        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)!.push(doc);
      }

      const groups = Array.from(groupMap.entries()).map(([key, docs]) => {
        const firstDoc = docs[0];
        return {
          script: key
            ? { id: key, name: firstDoc.script_name ?? "" }
            : null,
          documents: docs,
        };
      });

      return NextResponse.json(
        { groups, total: docItems.length },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { items: docItems, total: docItems.length },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "未知错误";

    return NextResponse.json(
      { error: message, code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
