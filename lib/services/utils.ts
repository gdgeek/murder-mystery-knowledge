// ============================================================================
// Pure utility functions for the service layer (no Supabase dependency)
// ============================================================================

const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Determine review_status from a confidence record.
 * If any field score < 0.7 → "pending_review", else "approved".
 */
export function computeReviewStatus(
  confidence: Record<string, number> | null | undefined,
): 'approved' | 'pending_review' {
  if (!confidence) return 'pending_review';
  const scores = Object.values(confidence);
  if (scores.length === 0) return 'pending_review';
  return scores.some((s) => s < CONFIDENCE_THRESHOLD)
    ? 'pending_review'
    : 'approved';
}

// ============================================================================
// Search result types & RRF algorithm
// ============================================================================

export interface SearchResult {
  id: string;
  type: string;
  data: Record<string, unknown>;
  source: {
    document_name: string;
    script_name?: string;
    page_start?: number;
    page_end?: number;
  };
  score: number;
}

/**
 * Reciprocal Rank Fusion (RRF) algorithm.
 *
 * For each result, RRF score = sum(1 / (k + rank_in_list)) across all lists
 * containing it. Results are sorted by RRF score descending.
 */
export function mergeWithRRF(
  structuredResults: SearchResult[],
  semanticResults: SearchResult[],
  k: number = 60,
): SearchResult[] {
  const scoreMap = new Map<string, { result: SearchResult; rrfScore: number }>();

  const addScores = (results: SearchResult[]) => {
    results.forEach((result, rank) => {
      const rrfContribution = 1 / (k + rank + 1); // rank is 0-indexed, so +1
      const existing = scoreMap.get(result.id);
      if (existing) {
        existing.rrfScore += rrfContribution;
      } else {
        scoreMap.set(result.id, {
          result: { ...result },
          rrfScore: rrfContribution,
        });
      }
    });
  };

  addScores(structuredResults);
  addScores(semanticResults);

  const merged = Array.from(scoreMap.values());
  merged.sort((a, b) => b.rrfScore - a.rrfScore);

  return merged.map((entry) => ({
    ...entry.result,
    score: entry.rrfScore,
  }));
}
