// ============================================================================
// Confidence evaluation and review status utilities for the Extraction Pipeline
// ============================================================================

import { computeReviewStatus } from '../../services/utils';

// Re-export for convenience
export { computeReviewStatus };

/** Default confidence threshold — fields below this trigger pending_review */
export const CONFIDENCE_THRESHOLD = 0.7;

// ============================================================================
// Types
// ============================================================================

export interface ConfidenceAwareResult {
  confidence?: Record<string, number> | null;
  review_status?: 'approved' | 'pending_review';
  [key: string]: unknown;
}

export interface FieldBelowThreshold {
  field: string;
  score: number;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Takes a full extraction result and returns an enriched copy with the
 * `review_status` computed from the confidence scores.
 */
export function evaluateConfidence<T extends ConfidenceAwareResult>(
  extractionResult: T,
): T {
  const confidence = extractionResult.confidence ?? null;
  const review_status = computeReviewStatus(
    confidence as Record<string, number> | null | undefined,
  );
  return { ...extractionResult, review_status };
}

/**
 * Returns the list of field names whose confidence score falls below the
 * given threshold. Useful for UI display of fields needing human review.
 */
export function getFieldsBelowThreshold(
  confidence: Record<string, number> | null | undefined,
  threshold: number = CONFIDENCE_THRESHOLD,
): FieldBelowThreshold[] {
  if (!confidence) return [];
  return Object.entries(confidence)
    .filter(([, score]) => score < threshold)
    .map(([field, score]) => ({ field, score }));
}
