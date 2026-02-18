import { describe, it, expect } from 'vitest';
import { computeReviewStatus } from '../../../lib/services/utils';

describe('computeReviewStatus', () => {
  it('returns "approved" when all scores >= 0.7', () => {
    expect(computeReviewStatus({ name: 0.9, type: 0.8, mechanism: 0.7 })).toBe(
      'approved',
    );
  });

  it('returns "pending_review" when any score < 0.7', () => {
    expect(computeReviewStatus({ name: 0.9, type: 0.69 })).toBe(
      'pending_review',
    );
  });

  it('returns "pending_review" for null confidence', () => {
    expect(computeReviewStatus(null)).toBe('pending_review');
  });

  it('returns "pending_review" for undefined confidence', () => {
    expect(computeReviewStatus(undefined)).toBe('pending_review');
  });

  it('returns "pending_review" for empty confidence object', () => {
    expect(computeReviewStatus({})).toBe('pending_review');
  });

  it('returns "approved" when exactly at threshold (0.7)', () => {
    expect(computeReviewStatus({ field: 0.7 })).toBe('approved');
  });

  it('returns "pending_review" when just below threshold', () => {
    expect(computeReviewStatus({ field: 0.6999 })).toBe('pending_review');
  });

  it('handles single field confidence', () => {
    expect(computeReviewStatus({ only: 1.0 })).toBe('approved');
    expect(computeReviewStatus({ only: 0.0 })).toBe('pending_review');
  });
});
