// ============================================================================
// Merge Results Node
//
// Combines structured and semantic search results using Reciprocal Rank
// Fusion (RRF). Each result retains its source information and receives
// an RRF-based relevance score.
//
// Requirements: 12.3, 12.4
// ============================================================================

import { mergeWithRRF, type SearchResult } from '../../../services/utils';

export { type SearchResult } from '../../../services/utils';

/**
 * Merge structured and semantic search results using RRF.
 *
 * @param structuredResults  Results from the structured search node
 * @param semanticResults    Results from the semantic search node
 * @param limit              Optional cap on the number of returned results
 */
export function mergeSearchResults(
  structuredResults: SearchResult[],
  semanticResults: SearchResult[],
  limit?: number,
): SearchResult[] {
  const merged = mergeWithRRF(structuredResults, semanticResults);

  if (limit !== undefined && limit >= 0) {
    return merged.slice(0, limit);
  }

  return merged;
}
