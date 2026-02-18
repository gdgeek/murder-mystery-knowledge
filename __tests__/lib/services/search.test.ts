import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeWithRRF, type SearchResult } from '../../../lib/services/utils';

// ============================================================================
// Mock Supabase for structuredSearch tests
// ============================================================================

const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock vector module to avoid import issues
vi.mock('../../../lib/services/vector', () => ({
  similaritySearch: vi.fn(),
}));

// Import after mocks
import { structuredSearch } from '../../../lib/services/search';

function makeResult(id: string, score: number = 0): SearchResult {
  return {
    id,
    type: 'trick',
    data: {},
    source: { document_name: 'test.pdf', page_start: 1, page_end: 2 },
    score,
  };
}

// ============================================================================
// structuredSearch tests
// ============================================================================

describe('structuredSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMockChain(data: Record<string, unknown>[] | null, error: unknown = null) {
    const eqFn = vi.fn().mockReturnThis();
    const selectFn = vi.fn(() => ({
      eq: eqFn,
      then: undefined,
    }));

    // Make the chain thenable (Supabase returns a PromiseLike)
    const queryObj = {
      eq: eqFn,
      select: selectFn,
    };

    // The final call in the chain resolves the promise
    // We need to handle the case where .eq() is called multiple times
    // The last call should resolve with data
    let callCount = 0;
    eqFn.mockImplementation(() => {
      callCount++;
      return {
        eq: eqFn,
        then: (resolve: (val: { data: unknown; error: unknown }) => void) => {
          resolve({ data, error });
        },
      };
    });

    // If no .eq() calls, select itself should be thenable
    selectFn.mockImplementation(() => ({
      eq: eqFn,
      then: (resolve: (val: { data: unknown; error: unknown }) => void) => {
        resolve({ data, error });
      },
    }));

    mockFrom.mockReturnValue({ select: selectFn });

    return { selectFn, eqFn };
  }

  it('returns empty array for unknown entity_type', async () => {
    const result = await structuredSearch({ entity_type: 'unknown_type' });
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('queries the correct table for entity_type', async () => {
    const { selectFn } = setupMockChain([]);

    await structuredSearch({ entity_type: 'trick' });

    expect(mockFrom).toHaveBeenCalledWith('tricks');
    expect(selectFn).toHaveBeenCalledWith('*, documents!inner(filename), scripts(name)');
  });

  it('applies script_id as an eq filter', async () => {
    const { eqFn } = setupMockChain([]);

    await structuredSearch({
      entity_type: 'character',
      script_id: 'script-123',
    });

    expect(mockFrom).toHaveBeenCalledWith('characters');
    expect(eqFn).toHaveBeenCalledWith('script_id', 'script-123');
  });

  it('includes script_name in source when scripts data is present', async () => {
    setupMockChain([
      {
        id: 'entity-1',
        documents: { filename: 'doc.pdf' },
        scripts: { name: '密室逃脱' },
        page_start: 1,
        page_end: 5,
      },
    ]);

    const results = await structuredSearch({ entity_type: 'trick' });

    expect(results).toHaveLength(1);
    expect(results[0].source.script_name).toBe('密室逃脱');
    expect(results[0].source.document_name).toBe('doc.pdf');
  });

  it('omits script_name when scripts data is null', async () => {
    setupMockChain([
      {
        id: 'entity-1',
        documents: { filename: 'doc.pdf' },
        scripts: null,
        page_start: 1,
        page_end: 5,
      },
    ]);

    const results = await structuredSearch({ entity_type: 'trick' });

    expect(results).toHaveLength(1);
    expect(results[0].source.script_name).toBeUndefined();
    expect(results[0].source.document_name).toBe('doc.pdf');
  });

  it('applies multiple filter conditions including script_id', async () => {
    const { eqFn } = setupMockChain([]);

    await structuredSearch({
      entity_type: 'character',
      script_id: 'script-abc',
      role: 'detective',
    });

    expect(eqFn).toHaveBeenCalledWith('script_id', 'script-abc');
    expect(eqFn).toHaveBeenCalledWith('role', 'detective');
  });

  it('skips undefined and null filter values', async () => {
    const { eqFn } = setupMockChain([]);

    await structuredSearch({
      entity_type: 'trick',
      script_id: undefined,
      type: null as unknown as string,
      name: 'test',
    });

    // Only 'name' should be applied (script_id is undefined, type is null)
    expect(eqFn).toHaveBeenCalledTimes(1);
    expect(eqFn).toHaveBeenCalledWith('name', 'test');
  });

  it('throws on supabase error', async () => {
    setupMockChain(null, { message: 'DB error' });

    await expect(
      structuredSearch({ entity_type: 'trick' }),
    ).rejects.toEqual({ message: 'DB error' });
  });

  it('returns results with rank-based scores', async () => {
    setupMockChain([
      { id: 'a', documents: { filename: 'a.pdf' }, scripts: null },
      { id: 'b', documents: { filename: 'b.pdf' }, scripts: null },
      { id: 'c', documents: { filename: 'c.pdf' }, scripts: null },
    ]);

    const results = await structuredSearch({ entity_type: 'clue' });

    expect(results).toHaveLength(3);
    expect(results[0].score).toBe(1); // 1/(1+0)
    expect(results[1].score).toBe(0.5); // 1/(1+1)
    expect(results[2].score).toBeCloseTo(1 / 3); // 1/(1+2)
  });
});

// ============================================================================
// mergeWithRRF tests
// ============================================================================

describe('mergeWithRRF', () => {
  it('returns empty array when both inputs are empty', () => {
    expect(mergeWithRRF([], [])).toEqual([]);
  });

  it('handles single list with results', () => {
    const structured = [makeResult('a'), makeResult('b')];
    const result = mergeWithRRF(structured, []);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
    // First item should have higher score
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it('merges results from both lists', () => {
    const structured = [makeResult('a'), makeResult('b')];
    const semantic = [makeResult('c'), makeResult('a')];
    const result = mergeWithRRF(structured, semantic);

    // 'a' appears in both lists, should have highest RRF score
    expect(result[0].id).toBe('a');
    expect(result).toHaveLength(3);
  });

  it('produces monotonically decreasing scores', () => {
    const structured = [makeResult('a'), makeResult('b'), makeResult('c')];
    const semantic = [makeResult('c'), makeResult('d'), makeResult('a')];
    const result = mergeWithRRF(structured, semantic);

    for (let i = 1; i < result.length; i++) {
      expect(result[i].score).toBeLessThanOrEqual(result[i - 1].score);
    }
  });

  it('uses custom k parameter', () => {
    const structured = [makeResult('a')];
    const semantic = [makeResult('a')];

    const resultK60 = mergeWithRRF(structured, semantic, 60);
    const resultK10 = mergeWithRRF(structured, semantic, 10);

    // With smaller k, the RRF score should be higher
    expect(resultK10[0].score).toBeGreaterThan(resultK60[0].score);
  });

  it('correctly computes RRF scores', () => {
    const k = 60;
    const structured = [makeResult('a')]; // rank 0 → 1/(60+1) = 1/61
    const semantic = [makeResult('a')];   // rank 0 → 1/(60+1) = 1/61

    const result = mergeWithRRF(structured, semantic, k);
    const expectedScore = 2 / (k + 1); // appears at rank 0 in both lists
    expect(result[0].score).toBeCloseTo(expectedScore, 10);
  });

  it('preserves source information in merged results', () => {
    const structured = [
      {
        ...makeResult('a'),
        source: { document_name: 'script1.pdf', page_start: 5, page_end: 10 },
      },
    ];
    const result = mergeWithRRF(structured, []);
    expect(result[0].source.document_name).toBe('script1.pdf');
    expect(result[0].source.page_start).toBe(5);
    expect(result[0].source.page_end).toBe(10);
  });

  it('handles duplicate IDs across lists correctly', () => {
    const structured = [makeResult('x'), makeResult('y')];
    const semantic = [makeResult('y'), makeResult('z')];
    const result = mergeWithRRF(structured, semantic);

    const ids = result.map((r) => r.id);
    // No duplicate IDs in output
    expect(new Set(ids).size).toBe(ids.length);
    // 'y' appears in both, should rank highest
    expect(result[0].id).toBe('y');
  });
});
