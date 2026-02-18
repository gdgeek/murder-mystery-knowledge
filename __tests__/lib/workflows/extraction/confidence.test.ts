import { describe, it, expect } from 'vitest';
import {
  CONFIDENCE_THRESHOLD,
  computeReviewStatus,
  evaluateConfidence,
  getFieldsBelowThreshold,
  type ConfidenceAwareResult,
} from '../../../../lib/workflows/extraction/confidence';

// ============================================================================
// CONFIDENCE_THRESHOLD constant
// ============================================================================

describe('CONFIDENCE_THRESHOLD', () => {
  it('equals 0.7', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.7);
  });
});

// ============================================================================
// computeReviewStatus (re-exported from utils)
// ============================================================================

describe('computeReviewStatus', () => {
  it('returns approved when all scores >= 0.7', () => {
    expect(computeReviewStatus({ name: 0.9, type: 0.8 })).toBe('approved');
  });

  it('returns pending_review when any score < 0.7', () => {
    expect(computeReviewStatus({ name: 0.9, type: 0.5 })).toBe('pending_review');
  });

  it('returns pending_review for null confidence', () => {
    expect(computeReviewStatus(null)).toBe('pending_review');
  });

  it('returns pending_review for undefined confidence', () => {
    expect(computeReviewStatus(undefined)).toBe('pending_review');
  });

  it('returns pending_review for empty confidence object', () => {
    expect(computeReviewStatus({})).toBe('pending_review');
  });

  it('returns approved when score is exactly 0.7', () => {
    expect(computeReviewStatus({ field: 0.7 })).toBe('approved');
  });
});

// ============================================================================
// evaluateConfidence
// ============================================================================

describe('evaluateConfidence', () => {
  it('sets review_status to approved when all confidence scores are high', () => {
    const input: ConfidenceAwareResult = {
      name: '密室诡计',
      type: 'locked_room',
      confidence: { name: 0.95, type: 0.9 },
    };
    const result = evaluateConfidence(input);

    expect(result.review_status).toBe('approved');
    expect(result.name).toBe('密室诡计');
  });

  it('sets review_status to pending_review when any score is below threshold', () => {
    const input: ConfidenceAwareResult = {
      name: '角色A',
      confidence: { name: 0.9, role: 0.3 },
    };
    const result = evaluateConfidence(input);

    expect(result.review_status).toBe('pending_review');
  });

  it('sets review_status to pending_review when confidence is null', () => {
    const input: ConfidenceAwareResult = {
      name: '角色B',
      confidence: null,
    };
    const result = evaluateConfidence(input);

    expect(result.review_status).toBe('pending_review');
  });

  it('sets review_status to pending_review when confidence is missing', () => {
    const input: ConfidenceAwareResult = { name: '角色C' };
    const result = evaluateConfidence(input);

    expect(result.review_status).toBe('pending_review');
  });

  it('overrides an incorrect review_status from LLM output', () => {
    const result = evaluateConfidence({
      name: '诡计X',
      confidence: { name: 0.9, type: 0.4 },
      review_status: 'approved', // incorrect — should be overridden
    });

    expect(result.review_status).toBe('pending_review');
  });

  it('does not mutate the original object', () => {
    const original = {
      name: 'test',
      confidence: { name: 0.5 },
      review_status: 'approved' as const,
    };

    const enriched = evaluateConfidence(original);

    expect(original.review_status).toBe('approved');
    expect(enriched.review_status).toBe('pending_review');
  });
});

// ============================================================================
// getFieldsBelowThreshold
// ============================================================================

describe('getFieldsBelowThreshold', () => {
  it('returns fields below the default threshold (0.7)', () => {
    const fields = getFieldsBelowThreshold({ name: 0.9, type: 0.5, mechanism: 0.3 });

    expect(fields).toEqual(
      expect.arrayContaining([
        { field: 'type', score: 0.5 },
        { field: 'mechanism', score: 0.3 },
      ]),
    );
    expect(fields).toHaveLength(2);
  });

  it('returns empty array when all fields are above threshold', () => {
    const fields = getFieldsBelowThreshold({ name: 0.9, type: 0.8 });
    expect(fields).toEqual([]);
  });

  it('returns empty array for null confidence', () => {
    expect(getFieldsBelowThreshold(null)).toEqual([]);
  });

  it('returns empty array for undefined confidence', () => {
    expect(getFieldsBelowThreshold(undefined)).toEqual([]);
  });

  it('supports a custom threshold', () => {
    const fields = getFieldsBelowThreshold({ a: 0.8, b: 0.9 }, 0.85);

    expect(fields).toEqual([{ field: 'a', score: 0.8 }]);
  });

  it('treats score exactly equal to threshold as above (not below)', () => {
    const fields = getFieldsBelowThreshold({ a: 0.7 });
    expect(fields).toEqual([]);
  });

  it('returns all fields when all are below threshold', () => {
    const fields = getFieldsBelowThreshold({ a: 0.1, b: 0.2, c: 0.3 });
    expect(fields).toHaveLength(3);
  });
});
