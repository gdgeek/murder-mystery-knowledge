import { describe, it, expect } from 'vitest';
import {
  mergeSearchResults,
  type SearchResult,
} from '../../../../../lib/workflows/retrieval/nodes/merge-results';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'r1',
    type: 'trick',
    data: { name: 'Test' },
    source: { document_name: 'test.pdf', page_start: 1, page_end: 3 },
    score: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mergeSearchResults', () => {
  it('returns empty array when both inputs are empty', () => {
    expect(mergeSearchResults([], [])).toEqual([]);
  });

  it('returns structured results when semantic results are empty', () => {
    const structured = [makeResult({ id: 'a' })];
    const result = mergeSearchResults(structured, []);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns semantic results when structured results are empty', () => {
    const semantic = [makeResult({ id: 'b', type: 'document_chunk' })];
    const result = mergeSearchResults([], semantic);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('merges results from both sources with RRF scores', () => {
    const structured = [makeResult({ id: 'a' }), makeResult({ id: 'b' })];
    const semantic = [makeResult({ id: 'c' }), makeResult({ id: 'a' })];

    const result = mergeSearchResults(structured, semantic);

    // 'a' appears in both lists so it should have the highest RRF score
    expect(result[0].id).toBe('a');
    expect(result).toHaveLength(3); // a, b, c
  });

  it('assigns numeric scores to all results', () => {
    const structured = [makeResult({ id: 'a' })];
    const semantic = [makeResult({ id: 'b' })];

    const result = mergeSearchResults(structured, semantic);

    for (const r of result) {
      expect(typeof r.score).toBe('number');
      expect(r.score).toBeGreaterThan(0);
    }
  });

  it('preserves source information on merged results', () => {
    const structured = [
      makeResult({
        id: 'a',
        source: { document_name: 'script1.pdf', page_start: 5, page_end: 10 },
      }),
    ];
    const semantic = [
      makeResult({
        id: 'b',
        source: { document_name: 'script2.pdf', page_start: 1, page_end: 2 },
      }),
    ];

    const result = mergeSearchResults(structured, semantic);

    const sourceA = result.find((r) => r.id === 'a')!.source;
    expect(sourceA.document_name).toBe('script1.pdf');
    expect(sourceA.page_start).toBe(5);
    expect(sourceA.page_end).toBe(10);

    const sourceB = result.find((r) => r.id === 'b')!.source;
    expect(sourceB.document_name).toBe('script2.pdf');
  });

  it('limits the number of returned results when limit is provided', () => {
    const structured = [makeResult({ id: 'a' }), makeResult({ id: 'b' })];
    const semantic = [makeResult({ id: 'c' }), makeResult({ id: 'd' })];

    const result = mergeSearchResults(structured, semantic, 2);

    expect(result).toHaveLength(2);
  });

  it('returns all results when limit exceeds total count', () => {
    const structured = [makeResult({ id: 'a' })];
    const semantic = [makeResult({ id: 'b' })];

    const result = mergeSearchResults(structured, semantic, 100);

    expect(result).toHaveLength(2);
  });

  it('returns all results when limit is undefined', () => {
    const structured = [makeResult({ id: 'a' }), makeResult({ id: 'b' })];
    const semantic = [makeResult({ id: 'c' })];

    const result = mergeSearchResults(structured, semantic);

    expect(result).toHaveLength(3);
  });

  it('returns scores in descending order', () => {
    const structured = [
      makeResult({ id: 'a' }),
      makeResult({ id: 'b' }),
      makeResult({ id: 'c' }),
    ];
    const semantic = [
      makeResult({ id: 'c' }),
      makeResult({ id: 'a' }),
      makeResult({ id: 'd' }),
    ];

    const result = mergeSearchResults(structured, semantic);

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });
});
