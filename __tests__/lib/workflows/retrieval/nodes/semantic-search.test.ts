import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks – declared before importing the module under test
// ---------------------------------------------------------------------------

const mockSemanticSearch = vi.fn();
const mockEmbedQuery = vi.fn();

vi.mock('../../../../../lib/services/search', () => ({
  semanticSearch: (...args: unknown[]) => mockSemanticSearch(...args),
}));

vi.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: vi.fn().mockImplementation(() => ({
    embedQuery: mockEmbedQuery,
  })),
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------

import { performSemanticSearch } from '../../../../../lib/workflows/retrieval/nodes/semantic-search';
import type { SearchResult } from '../../../../../lib/services/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'chunk-1',
    type: 'document_chunk',
    data: { content: 'Some text', chunk_index: 0 },
    source: { document_name: 'test.pdf', page_start: 1, page_end: 2 },
    score: 0.95,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('performSemanticSearch', () => {
  beforeEach(() => {
    mockSemanticSearch.mockReset();
    mockEmbedQuery.mockReset();
  });

  it('returns empty array when semanticQuery is undefined', async () => {
    const result = await performSemanticSearch(undefined);

    expect(result).toEqual([]);
    expect(mockEmbedQuery).not.toHaveBeenCalled();
    expect(mockSemanticSearch).not.toHaveBeenCalled();
  });

  it('returns empty array when semanticQuery is empty string', async () => {
    const result = await performSemanticSearch('');

    expect(result).toEqual([]);
    expect(mockEmbedQuery).not.toHaveBeenCalled();
    expect(mockSemanticSearch).not.toHaveBeenCalled();
  });

  it('returns empty array when semanticQuery is whitespace only', async () => {
    const result = await performSemanticSearch('   ');

    expect(result).toEqual([]);
    expect(mockEmbedQuery).not.toHaveBeenCalled();
    expect(mockSemanticSearch).not.toHaveBeenCalled();
  });

  it('embeds the query and calls semanticSearch with the embedding', async () => {
    const fakeEmbedding = [0.1, 0.2, 0.3];
    mockEmbedQuery.mockResolvedValue(fakeEmbedding);
    mockSemanticSearch.mockResolvedValue([makeResult()]);

    const result = await performSemanticSearch('如何设计推理链');

    expect(mockEmbedQuery).toHaveBeenCalledWith('如何设计推理链');
    expect(mockSemanticSearch).toHaveBeenCalledWith(fakeEmbedding, 10);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('chunk-1');
  });

  it('respects the limit parameter', async () => {
    const fakeEmbedding = [0.5, 0.6];
    mockEmbedQuery.mockResolvedValue(fakeEmbedding);
    mockSemanticSearch.mockResolvedValue([]);

    await performSemanticSearch('密室诡计', 5);

    expect(mockSemanticSearch).toHaveBeenCalledWith(fakeEmbedding, 5);
  });

  it('uses injected embeddings instance when provided', async () => {
    const fakeEmbedding = [0.9, 0.8];
    const customEmbedQuery = vi.fn().mockResolvedValue(fakeEmbedding);
    const customEmbeddings = { embedQuery: customEmbedQuery } as any;

    mockSemanticSearch.mockResolvedValue([makeResult()]);

    const result = await performSemanticSearch('test query', 10, customEmbeddings);

    expect(customEmbedQuery).toHaveBeenCalledWith('test query');
    expect(mockSemanticSearch).toHaveBeenCalledWith(fakeEmbedding, 10);
    expect(result).toHaveLength(1);
  });

  it('returns multiple results from semanticSearch', async () => {
    mockEmbedQuery.mockResolvedValue([0.1]);
    const results = [
      makeResult({ id: 'a', score: 0.95 }),
      makeResult({ id: 'b', score: 0.85 }),
      makeResult({ id: 'c', score: 0.75 }),
    ];
    mockSemanticSearch.mockResolvedValue(results);

    const actual = await performSemanticSearch('叙事技法');

    expect(actual).toHaveLength(3);
    expect(actual.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns the results from semanticSearch as-is', async () => {
    const expected = [makeResult({ id: 'x', score: 0.99 })];
    mockEmbedQuery.mockResolvedValue([0.1]);
    mockSemanticSearch.mockResolvedValue(expected);

    const result = await performSemanticSearch('情感设计');

    expect(result).toBe(expected);
  });
});
