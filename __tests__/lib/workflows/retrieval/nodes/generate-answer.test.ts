import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks – declared before importing the module under test
// ---------------------------------------------------------------------------

let mockChainInvokeResult = '';
let mockStreamChunks: string[] = [];

// Mock lib/ai/provider – createChatModel returns a mock LLM object
vi.mock('../../../../../lib/ai/provider', () => ({
  createChatModel: vi.fn().mockResolvedValue({}),
}));

vi.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: vi.fn().mockReturnValue({
      pipe: vi.fn().mockReturnValue({
        pipe: vi.fn().mockReturnValue({
          invoke: vi.fn().mockImplementation(async () => mockChainInvokeResult),
          stream: vi.fn().mockImplementation(async function* () {
            for (const chunk of mockStreamChunks) {
              yield chunk;
            }
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@langchain/core/output_parsers', () => ({
  StringOutputParser: vi.fn().mockImplementation(() => ({})),
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------

import {
  generateAnswer,
  generateAnswerStream,
  buildContext,
  extractSources,
  type AnswerSource,
} from '../../../../../lib/workflows/retrieval/nodes/generate-answer';
import type { SearchResult } from '../../../../../lib/services/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'r1',
    type: 'trick',
    data: { name: '密室诡计A', mechanism: '利用暗门逃脱' },
    source: { document_name: '迷雾庄园.pdf', page_start: 5, page_end: 8 },
    score: 0.85,
    ...overrides,
  };
}


function collectStream(stream: ReadableStream<string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = stream.getReader();
    let result = '';
    function read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          resolve(result);
          return;
        }
        result += value;
        read();
      }, reject);
    }
    read();
  });
}

// ---------------------------------------------------------------------------
// Tests: buildContext
// ---------------------------------------------------------------------------

describe('buildContext', () => {
  it('returns empty string for empty results', () => {
    expect(buildContext([])).toBe('');
  });

  it('builds context with source headers and data', () => {
    const results = [makeResult()];
    const ctx = buildContext(results);

    expect(ctx).toContain('[1] 来源: 迷雾庄园.pdf (页码 5-8)');
    expect(ctx).toContain('密室诡计A');
  });

  it('handles results without page info', () => {
    const results = [
      makeResult({
        source: { document_name: '无页码剧本.pdf' },
      }),
    ];
    const ctx = buildContext(results);

    expect(ctx).toContain('[1] 来源: 无页码剧本.pdf');
    expect(ctx).not.toMatch(/\(页码/); // no parenthesized page info
  });

  it('handles results with same page_start and page_end', () => {
    const results = [
      makeResult({
        source: { document_name: 'test.pdf', page_start: 3, page_end: 3 },
      }),
    ];
    const ctx = buildContext(results);

    expect(ctx).toContain('(页码 3)');
  });

  it('numbers multiple results sequentially', () => {
    const results = [
      makeResult({ id: 'r1' }),
      makeResult({ id: 'r2', source: { document_name: '暗夜追凶.pdf', page_start: 10, page_end: 12 } }),
    ];
    const ctx = buildContext(results);

    expect(ctx).toContain('[1] 来源: 迷雾庄园.pdf');
    expect(ctx).toContain('[2] 来源: 暗夜追凶.pdf');
  });
});

// ---------------------------------------------------------------------------
// Tests: extractSources
// ---------------------------------------------------------------------------

describe('extractSources', () => {
  it('returns empty array for empty results', () => {
    expect(extractSources([])).toEqual([]);
  });

  it('extracts unique sources', () => {
    const results = [
      makeResult({ id: 'r1' }),
      makeResult({ id: 'r2' }), // same source as r1
    ];
    const sources = extractSources(results);

    expect(sources).toHaveLength(1);
    expect(sources[0].document_name).toBe('迷雾庄园.pdf');
  });

  it('keeps different sources separate', () => {
    const results = [
      makeResult({ id: 'r1' }),
      makeResult({
        id: 'r2',
        source: { document_name: '暗夜追凶.pdf', page_start: 1, page_end: 3 },
      }),
    ];
    const sources = extractSources(results);

    expect(sources).toHaveLength(2);
    expect(sources.map((s) => s.document_name)).toEqual([
      '迷雾庄园.pdf',
      '暗夜追凶.pdf',
    ]);
  });

  it('omits page fields when not present in source', () => {
    const results = [
      makeResult({ source: { document_name: 'no-pages.pdf' } }),
    ];
    const sources = extractSources(results);

    expect(sources).toHaveLength(1);
    expect(sources[0]).toEqual({ document_name: 'no-pages.pdf' });
    expect('page_start' in sources[0]).toBe(false);
  });

  it('treats same document with different pages as different sources', () => {
    const results = [
      makeResult({ id: 'r1', source: { document_name: 'a.pdf', page_start: 1, page_end: 3 } }),
      makeResult({ id: 'r2', source: { document_name: 'a.pdf', page_start: 5, page_end: 7 } }),
    ];
    const sources = extractSources(results);

    expect(sources).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: generateAnswer
// ---------------------------------------------------------------------------

describe('generateAnswer', () => {
  beforeEach(() => {
    mockChainInvokeResult = '';
    vi.clearAllMocks();
  });

  it('returns no-results message when search results are empty', async () => {
    const result = await generateAnswer('什么是密室诡计？', []);

    expect(result.answer).toContain('没有找到');
    expect(result.sources).toEqual([]);
  });

  it('returns LLM answer with sources when results are provided', async () => {
    mockChainInvokeResult =
      '密室诡计是一种常见的作案手法 [来源: 迷雾庄园.pdf, 页码 5-8]';

    const results = [makeResult()];
    const result = await generateAnswer('什么是密室诡计？', results);

    expect(result.answer).toContain('密室诡计');
    expect(result.answer).toContain('[来源: 迷雾庄园.pdf');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].document_name).toBe('迷雾庄园.pdf');
  });

  it('deduplicates sources in the result', async () => {
    mockChainInvokeResult = '回答内容';

    const results = [
      makeResult({ id: 'r1' }),
      makeResult({ id: 'r2' }), // same source
    ];
    const result = await generateAnswer('问题', results);

    expect(result.sources).toHaveLength(1);
  });

  it('accepts custom model options', async () => {
    mockChainInvokeResult = '回答';

    const result = await generateAnswer('问题', [makeResult()], undefined, {
      temperature: 0.5,
    });

    expect(result.answer).toBe('回答');
  });
});

// ---------------------------------------------------------------------------
// Tests: generateAnswerStream
// ---------------------------------------------------------------------------

describe('generateAnswerStream', () => {
  beforeEach(() => {
    mockStreamChunks = [];
    vi.clearAllMocks();
  });

  it('returns no-results stream when search results are empty', async () => {
    const { stream, sources } = generateAnswerStream('问题', []);

    const text = await collectStream(stream);
    expect(text).toContain('没有找到');
    expect(sources).toEqual([]);
  });

  it('streams answer chunks from LLM', async () => {
    mockStreamChunks = ['密室', '诡计', '是一种', '手法'];

    const results = [makeResult()];
    const { stream, sources } = generateAnswerStream('什么是密室诡计？', results);

    const text = await collectStream(stream);
    expect(text).toBe('密室诡计是一种手法');
    expect(sources).toHaveLength(1);
    expect(sources[0].document_name).toBe('迷雾庄园.pdf');
  });

  it('returns sources immediately without waiting for stream', () => {
    mockStreamChunks = ['chunk'];

    const results = [
      makeResult({ source: { document_name: 'a.pdf', page_start: 1, page_end: 2 } }),
      makeResult({ id: 'r2', source: { document_name: 'b.pdf', page_start: 3, page_end: 4 } }),
    ];
    const { sources } = generateAnswerStream('问题', results);

    expect(sources).toHaveLength(2);
    expect(sources[0].document_name).toBe('a.pdf');
    expect(sources[1].document_name).toBe('b.pdf');
  });
});
