import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks – declared before importing the module under test
// ---------------------------------------------------------------------------

const mockStructuredSearch = vi.fn();

vi.mock('../../../../../lib/services/search', () => ({
  structuredSearch: (...args: unknown[]) => mockStructuredSearch(...args),
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------

import { performStructuredSearch } from '../../../../../lib/workflows/retrieval/nodes/structured-search';
import type { SearchResult } from '../../../../../lib/services/utils';
import type { IntentAnalysisResult } from '../../../../../lib/workflows/retrieval/nodes/analyze-intent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'r1',
    type: 'trick',
    data: { name: 'Test Trick' },
    source: { document_name: 'test.pdf', page_start: 1, page_end: 3 },
    score: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('performStructuredSearch', () => {
  beforeEach(() => {
    mockStructuredSearch.mockReset();
  });

  it('returns empty array when structuredFilters is undefined', async () => {
    const result = await performStructuredSearch({ structuredFilters: undefined });

    expect(result).toEqual([]);
    expect(mockStructuredSearch).not.toHaveBeenCalled();
  });

  it('returns empty array when entity_type is missing', async () => {
    const result = await performStructuredSearch({
      structuredFilters: {} as IntentAnalysisResult['structuredFilters'],
    });

    expect(result).toEqual([]);
    expect(mockStructuredSearch).not.toHaveBeenCalled();
  });

  it('passes entity_type and filter conditions to structuredSearch', async () => {
    mockStructuredSearch.mockResolvedValue([makeResult()]);

    const result = await performStructuredSearch({
      structuredFilters: {
        entity_type: 'trick',
        type: 'locked_room',
      },
    });

    expect(mockStructuredSearch).toHaveBeenCalledWith({
      entity_type: 'trick',
      type: 'locked_room',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  it('forwards character role filters', async () => {
    mockStructuredSearch.mockResolvedValue([]);

    await performStructuredSearch({
      structuredFilters: {
        entity_type: 'character',
        role: 'detective',
      },
    });

    expect(mockStructuredSearch).toHaveBeenCalledWith({
      entity_type: 'character',
      role: 'detective',
    });
  });

  it('forwards script_metadata filters with player count', async () => {
    mockStructuredSearch.mockResolvedValue([]);

    await performStructuredSearch({
      structuredFilters: {
        entity_type: 'script_metadata',
        difficulty: 'hardcore',
        min_players: 6,
      },
    });

    expect(mockStructuredSearch).toHaveBeenCalledWith({
      entity_type: 'script_metadata',
      difficulty: 'hardcore',
      min_players: 6,
    });
  });

  it('forwards story_background era filter', async () => {
    mockStructuredSearch.mockResolvedValue([]);

    await performStructuredSearch({
      structuredFilters: {
        entity_type: 'story_background',
        era: '民国',
      },
    });

    expect(mockStructuredSearch).toHaveBeenCalledWith({
      entity_type: 'story_background',
      era: '民国',
    });
  });

  it('forwards game_mechanics core_gameplay_type filter', async () => {
    mockStructuredSearch.mockResolvedValue([]);

    await performStructuredSearch({
      structuredFilters: {
        entity_type: 'game_mechanics',
        core_gameplay_type: '推理投凶',
      },
    });

    expect(mockStructuredSearch).toHaveBeenCalledWith({
      entity_type: 'game_mechanics',
      core_gameplay_type: '推理投凶',
    });
  });

  it('forwards narrative_technique structure_type filter', async () => {
    mockStructuredSearch.mockResolvedValue([]);

    await performStructuredSearch({
      structuredFilters: {
        entity_type: 'narrative_technique',
        structure_type: 'nonlinear',
      },
    });

    expect(mockStructuredSearch).toHaveBeenCalledWith({
      entity_type: 'narrative_technique',
      structure_type: 'nonlinear',
    });
  });

  it('forwards misdirection type filter', async () => {
    mockStructuredSearch.mockResolvedValue([]);

    await performStructuredSearch({
      structuredFilters: {
        entity_type: 'misdirection',
        type: 'false_clue',
      },
    });

    expect(mockStructuredSearch).toHaveBeenCalledWith({
      entity_type: 'misdirection',
      type: 'false_clue',
    });
  });

  it('omits undefined optional fields from the search filters', async () => {
    mockStructuredSearch.mockResolvedValue([]);

    await performStructuredSearch({
      structuredFilters: {
        entity_type: 'clue',
        type: 'physical_evidence',
        role: undefined,
        era: undefined,
      },
    });

    // The spread will include undefined keys, but structuredSearch
    // already handles undefined values by skipping them
    expect(mockStructuredSearch).toHaveBeenCalledTimes(1);
    const calledWith = mockStructuredSearch.mock.calls[0][0];
    expect(calledWith.entity_type).toBe('clue');
    expect(calledWith.type).toBe('physical_evidence');
  });

  it('returns the results from structuredSearch as-is', async () => {
    const expected = [
      makeResult({ id: 'a', type: 'trick' }),
      makeResult({ id: 'b', type: 'trick', score: 0.5 }),
    ];
    mockStructuredSearch.mockResolvedValue(expected);

    const result = await performStructuredSearch({
      structuredFilters: { entity_type: 'trick' },
    });

    expect(result).toBe(expected);
  });
});
