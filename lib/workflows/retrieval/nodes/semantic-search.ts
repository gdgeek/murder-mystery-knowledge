// ============================================================================
// Semantic Search Node
//
// Generates an embedding for the query text using the configured Embedding
// provider and performs similarity search against pgvector via the search
// service.
//
// Requirements: 12.2
// ============================================================================

import { Embeddings } from '@langchain/core/embeddings';
import { createEmbeddings } from '../../../ai/provider';
import { semanticSearch, type SearchResult } from '../../../services/search';

/**
 * Perform a semantic search by embedding the query and searching pgvector.
 *
 * Returns an empty array when semanticQuery is undefined or empty.
 *
 * @param semanticQuery  Natural language query text
 * @param limit          Maximum number of results (default 10)
 * @param embeddings     Optional Embeddings instance for DI / testing
 */
export async function performSemanticSearch(
  semanticQuery: string | undefined,
  limit: number = 10,
  embeddings?: Embeddings,
): Promise<SearchResult[]> {
  if (!semanticQuery?.trim()) {
    return [];
  }

  const model =
    embeddings ??
    await createEmbeddings();

  const queryEmbedding = await model.embedQuery(semanticQuery);

  return semanticSearch(queryEmbedding, limit);
}
