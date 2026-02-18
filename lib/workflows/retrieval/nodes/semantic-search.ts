// ============================================================================
// Semantic Search Node
//
// Generates an embedding for the query text using OpenAI and performs
// similarity search against pgvector via the search service.
//
// Requirements: 12.2
// ============================================================================

import { OpenAIEmbeddings } from '@langchain/openai';
import { semanticSearch, type SearchResult } from '../../../services/search';

/**
 * Perform a semantic search by embedding the query and searching pgvector.
 *
 * Returns an empty array when semanticQuery is undefined or empty.
 *
 * @param semanticQuery  Natural language query text
 * @param limit          Maximum number of results (default 10)
 * @param embeddings     Optional OpenAIEmbeddings instance for DI / testing
 */
export async function performSemanticSearch(
  semanticQuery: string | undefined,
  limit: number = 10,
  embeddings?: OpenAIEmbeddings,
): Promise<SearchResult[]> {
  if (!semanticQuery?.trim()) {
    return [];
  }

  const model =
    embeddings ?? new OpenAIEmbeddings({ model: 'text-embedding-3-small' });

  const queryEmbedding = await model.embedQuery(semanticQuery);

  return semanticSearch(queryEmbedding, limit);
}
