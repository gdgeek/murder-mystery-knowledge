// ============================================================================
// Structured Search Node
//
// Bridges the intent analysis output to the search service's
// structuredSearch function. Takes structuredFilters from intent analysis,
// maps them to the format expected by the search service, and returns results.
//
// Requirements: 12.1
// ============================================================================

import {
  structuredSearch,
  type StructuredSearchFilters,
  type SearchResult,
} from '../../../services/search';
import type { IntentAnalysisResult } from './analyze-intent';

/**
 * Perform a structured search using filters extracted from intent analysis.
 *
 * Returns an empty array when structuredFilters is undefined or missing
 * a valid entity_type.
 */
export async function performStructuredSearch(
  intentResult: Pick<IntentAnalysisResult, 'structuredFilters'>,
): Promise<SearchResult[]> {
  const filters = intentResult.structuredFilters;

  if (!filters?.entity_type) {
    return [];
  }

  const { entity_type, ...rest } = filters;

  const searchFilters: StructuredSearchFilters = {
    entity_type,
    ...rest,
  };

  return structuredSearch(searchFilters);
}
