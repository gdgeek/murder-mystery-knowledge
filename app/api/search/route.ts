// ============================================================================
// Search API Route
//
// Accepts structured query conditions and/or natural language queries,
// executes the appropriate search strategy, and returns JSON results.
//
// Rather than invoking the full Retrieval Pipeline (which includes LLM
// intent analysis and answer generation), this route directly calls the
// search service layer — the user already provides explicit filters and/or
// a query string, so no LLM intent classification is needed.
//
// Requirements: 12.1, 12.2, 12.3
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { performStructuredSearch } from "@/lib/workflows/retrieval/nodes/structured-search";
import { performSemanticSearch } from "@/lib/workflows/retrieval/nodes/semantic-search";
import { mergeSearchResults } from "@/lib/workflows/retrieval/nodes/merge-results";

// ============================================================================
// Types
// ============================================================================

export interface SearchFilters {
  trick_type?: string;
  character_identity?: string;
  era?: string;
  act_count?: number;
  word_count_range?: { min?: number; max?: number };
  clue_type?: string;
  misdirection_type?: string;
  script_type_tags?: string[];
  script_id?: string;
  player_count?: number;
  play_type?: string;
  narrative_structure_type?: string;
}

export interface SearchRequestBody {
  /** Natural language query string */
  query?: string;
  /** Structured filter conditions */
  filters?: SearchFilters;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map user-facing filter names to the intent-analysis structured filters
 * format expected by performStructuredSearch.
 *
 * Each filter implies an entity_type. When multiple filters target different
 * entity types, the first one wins (callers should use separate requests for
 * cross-entity queries).
 */
export function mapFiltersToIntent(filters: SearchFilters) {
  const mapped: Record<string, unknown> = {};

  // script_id is a cross-cutting filter, pass through directly
  if (filters.script_id) {
    mapped.script_id = filters.script_id;
  }

  if (filters.trick_type) {
    mapped.entity_type = "trick";
    mapped.type = filters.trick_type;
  }
  if (filters.character_identity) {
    mapped.entity_type = mapped.entity_type ?? "character";
    mapped.role = filters.character_identity;
  }
  if (filters.era) {
    mapped.entity_type = mapped.entity_type ?? "story_background";
    mapped.era = filters.era;
  }
  if (filters.act_count !== undefined) {
    mapped.entity_type = mapped.entity_type ?? "script_format";
    mapped.act_count = filters.act_count;
  }
  if (filters.clue_type) {
    mapped.entity_type = mapped.entity_type ?? "clue";
    mapped.type = mapped.type ?? filters.clue_type;
  }
  if (filters.misdirection_type) {
    mapped.entity_type = mapped.entity_type ?? "misdirection";
    mapped.type = mapped.type ?? filters.misdirection_type;
  }
  if (filters.play_type) {
    mapped.entity_type = mapped.entity_type ?? "game_mechanics";
    mapped.core_gameplay_type = filters.play_type;
  }
  if (filters.narrative_structure_type) {
    mapped.entity_type = mapped.entity_type ?? "narrative_technique";
    mapped.structure_type = filters.narrative_structure_type;
  }
  if (filters.player_count !== undefined) {
    mapped.entity_type = mapped.entity_type ?? "script_metadata";
    mapped.min_players = filters.player_count;
    mapped.max_players = filters.player_count;
  }

  return mapped;
}

// ============================================================================
// POST /api/search
// ============================================================================

/**
 * POST /api/search
 *
 * Accepts JSON body with optional `query` (natural language string) and
 * optional `filters` (structured conditions). At least one must be provided.
 *
 * Returns JSON with `items` array, each containing type, data, source, and
 * score fields.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SearchRequestBody;

    const hasQuery =
      typeof body.query === "string" && body.query.trim().length > 0;
    const hasFilters =
      body.filters !== undefined &&
      body.filters !== null &&
      typeof body.filters === "object" &&
      Object.keys(body.filters).length > 0;

    // At least one of query or filters must be provided
    if (!hasQuery && !hasFilters) {
      return NextResponse.json(
        {
          error:
            "请提供查询条件：query（自然语言查询）或 filters（结构化条件）至少需要一个",
          code: "MISSING_QUERY",
        },
        { status: 400 },
      );
    }

    // Execute the appropriate search strategy
    const structuredResults = hasFilters
      ? await performStructuredSearch({
          structuredFilters: mapFiltersToIntent(body.filters!) as any,
        })
      : [];

    const semanticResults = hasQuery
      ? await performSemanticSearch(body.query!.trim())
      : [];

    // Merge results using RRF when both are present
    const results =
      hasQuery && hasFilters
        ? mergeSearchResults(structuredResults, semanticResults)
        : [...structuredResults, ...semanticResults];

    // Requirement 12.5: empty results suggestion
    if (results.length === 0) {
      return NextResponse.json(
        {
          items: [],
          total: 0,
          message:
            "未找到匹配的结果，建议调整查询条件或使用更宽泛的搜索词",
        },
        { status: 200 },
      );
    }

    const items = results.map((r) => ({
      type: r.type,
      data: r.data,
      source: r.source,
      score: r.score,
    }));

    return NextResponse.json(
      {
        items,
        total: items.length,
      },
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
