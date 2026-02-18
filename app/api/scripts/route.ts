import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * POST /api/scripts
 *
 * Creates a new script (剧本) with a name and optional description.
 *
 * Requirements: 1.1, 1.4
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    // Validate name is not empty or whitespace-only
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "剧本名称不能为空", code: "INVALID_NAME" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("scripts")
      .insert({ name: name.trim(), description: description ?? null })
      .select("id, name, description, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "未知错误";

    return NextResponse.json(
      { error: message, code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/scripts
 *
 * Returns the list of scripts with document counts.
 *
 * Requirements: 1.2
 */
export async function GET() {
  try {
    const { data: scripts, error } = await supabase
      .from("scripts")
      .select("id, name, description, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch document counts per script
    const { data: docCounts, error: docError } = await supabase
      .from("documents")
      .select("script_id")
      .not("script_id", "is", null);

    if (docError) throw docError;

    // Build a map of script_id → document count
    const countMap = new Map<string, number>();
    for (const row of docCounts ?? []) {
      const scriptId = row.script_id as string;
      countMap.set(scriptId, (countMap.get(scriptId) ?? 0) + 1);
    }

    const items = (scripts ?? []).map((script) => ({
      id: script.id,
      name: script.name,
      description: script.description,
      created_at: script.created_at,
      document_count: countMap.get(script.id) ?? 0,
    }));

    return NextResponse.json({ items, total: items.length }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "未知错误";

    return NextResponse.json(
      { error: message, code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
