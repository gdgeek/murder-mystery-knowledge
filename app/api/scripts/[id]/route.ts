import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/scripts/[id]
 *
 * Returns a single script's details including its associated documents.
 *
 * Requirements: 1.3
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Fetch the script record
    const { data: script, error: scriptError } = await supabase
      .from("scripts")
      .select("id, name, description, created_at")
      .eq("id", id)
      .single();

    if (scriptError) {
      // PostgREST returns code PGRST116 when no rows match .single()
      if (scriptError.code === "PGRST116") {
        return NextResponse.json(
          { error: "剧本不存在", code: "SCRIPT_NOT_FOUND" },
          { status: 404 },
        );
      }
      throw scriptError;
    }

    // Fetch associated documents
    const { data: documents, error: docError } = await supabase
      .from("documents")
      .select("id, filename, status, page_count, created_at")
      .eq("script_id", id)
      .order("created_at", { ascending: false });

    if (docError) throw docError;

    const response = {
      id: script.id,
      name: script.name,
      description: script.description,
      created_at: script.created_at,
      documents: documents ?? [],
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "未知错误";

    return NextResponse.json(
      { error: message, code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
