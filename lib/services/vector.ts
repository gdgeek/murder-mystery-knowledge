import { supabase } from '../supabase';

// ============================================================================
// Vector storage
// ============================================================================

/**
 * Store an embedding vector for a document chunk.
 */
export async function storeEmbedding(chunkId: string, embedding: number[]) {
  const { data, error } = await supabase
    .from('document_chunks')
    .update({ embedding: JSON.stringify(embedding) })
    .eq('id', chunkId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// Similarity search
// ============================================================================

export interface SimilarityResult {
  id: string;
  document_id: string;
  content: string;
  page_start: number;
  page_end: number;
  chunk_index: number;
  similarity: number;
}

/**
 * Execute a pgvector similarity search using Supabase RPC.
 *
 * Expects a Postgres function `match_documents` to be defined:
 *
 * ```sql
 * CREATE OR REPLACE FUNCTION match_documents(
 *   query_embedding vector(1536),
 *   match_count int DEFAULT 10,
 *   match_threshold float DEFAULT 0.5
 * ) RETURNS TABLE (
 *   id uuid,
 *   document_id uuid,
 *   content text,
 *   page_start int,
 *   page_end int,
 *   chunk_index int,
 *   similarity float
 * ) ...
 * ```
 *
 * If the RPC is not available, falls back to a raw query approach.
 */
export async function similaritySearch(
  queryEmbedding: number[],
  limit: number = 10,
  threshold: number = 0.5,
): Promise<SimilarityResult[]> {
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: limit,
    match_threshold: threshold,
  });

  if (error) throw error;
  return (data ?? []) as SimilarityResult[];
}
