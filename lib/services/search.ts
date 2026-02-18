import { supabase } from '../supabase';
import { similaritySearch } from './vector';
import { mergeWithRRF, type SearchResult } from './utils';

export { mergeWithRRF, type SearchResult } from './utils';

// ============================================================================
// Types
// ============================================================================

export interface StructuredSearchFilters {
  entity_type: string;
  script_id?: string;
  [key: string]: unknown;
}

// ============================================================================
// Structured search
// ============================================================================

/**
 * Execute a structured query against a specific entity table.
 * Builds Supabase filters from the provided conditions.
 */
export async function structuredSearch(
  filters: StructuredSearchFilters,
): Promise<SearchResult[]> {
  const { entity_type, ...conditions } = filters;

  const tableMap: Record<string, string> = {
    trick: 'tricks',
    character: 'characters',
    script_structure: 'script_structures',
    story_background: 'story_backgrounds',
    script_format: 'script_formats',
    player_script: 'player_scripts',
    clue: 'clues',
    reasoning_chain: 'reasoning_chains',
    misdirection: 'misdirections',
    script_metadata: 'script_metadata',
    game_mechanics: 'game_mechanics',
    narrative_technique: 'narrative_techniques',
    emotional_design: 'emotional_designs',
  };

  const table = tableMap[entity_type];
  if (!table) return [];

  // Join with documents and scripts to get source info
  let query = supabase
    .from(table)
    .select('*, documents!inner(filename), scripts(name)');

  for (const [key, value] of Object.entries(conditions)) {
    if (value !== undefined && value !== null) {
      query = query.eq(key, value);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data) return [];

  return (data as Record<string, unknown>[]).map((row, index) => {
    const docs = row.documents as Record<string, unknown> | undefined;
    const script = row.scripts as Record<string, unknown> | null | undefined;
    const scriptName = script?.name as string | undefined;
    return {
      id: row.id as string,
      type: entity_type,
      data: row,
      source: {
        document_name: (docs?.filename as string) ?? 'unknown',
        ...(scriptName ? { script_name: scriptName } : {}),
        page_start: row.page_start as number | undefined,
        page_end: row.page_end as number | undefined,
      },
      score: 1 / (1 + index), // rank-based score for structured results
    };
  });
}

// ============================================================================
// Semantic search
// ============================================================================

/**
 * Wrapper around vector similarity search that returns SearchResult format.
 */
export async function semanticSearch(
  queryEmbedding: number[],
  limit: number = 10,
): Promise<SearchResult[]> {
  const results = await similaritySearch(queryEmbedding, limit);

  // Fetch document filenames for source info
  const docIds = [...new Set(results.map((r) => r.document_id))];
  const docMap = new Map<string, string>();

  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from('documents')
      .select('id, filename')
      .in('id', docIds);

    if (docs) {
      for (const doc of docs) {
        docMap.set(doc.id, doc.filename);
      }
    }
  }

  return results.map((r) => ({
    id: r.id,
    type: 'document_chunk',
    data: { content: r.content, chunk_index: r.chunk_index },
    source: {
      document_name: docMap.get(r.document_id) ?? 'unknown',
      page_start: r.page_start,
      page_end: r.page_end,
    },
    score: r.similarity,
  }));
}

// ============================================================================
// Hybrid search
// ============================================================================

/**
 * Execute both structured and semantic searches, then merge with RRF.
 */
export async function hybridSearch(
  filters: StructuredSearchFilters,
  queryEmbedding: number[],
  limit: number = 10,
): Promise<SearchResult[]> {
  const [structuredResults, semanticResults] = await Promise.all([
    structuredSearch(filters),
    semanticSearch(queryEmbedding, limit),
  ]);

  const merged = mergeWithRRF(structuredResults, semanticResults);
  return merged.slice(0, limit);
}
