import { describe, it, expect } from 'vitest';
import {
  EMPTY_RESULTS_MESSAGE,
  QUERY_ADJUSTMENT_SUGGESTIONS,
  formatEmptyResultsResponse,
  isOutOfScope,
} from '../../../../lib/workflows/retrieval/empty-results';

// ---------------------------------------------------------------------------
// Tests: Exported constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('EMPTY_RESULTS_MESSAGE is a non-empty string', () => {
    expect(typeof EMPTY_RESULTS_MESSAGE).toBe('string');
    expect(EMPTY_RESULTS_MESSAGE.length).toBeGreaterThan(0);
  });

  it('QUERY_ADJUSTMENT_SUGGESTIONS is a non-empty array of strings', () => {
    expect(Array.isArray(QUERY_ADJUSTMENT_SUGGESTIONS)).toBe(true);
    expect(QUERY_ADJUSTMENT_SUGGESTIONS.length).toBeGreaterThan(0);
    for (const s of QUERY_ADJUSTMENT_SUGGESTIONS) {
      expect(typeof s).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: formatEmptyResultsResponse
// ---------------------------------------------------------------------------

describe('formatEmptyResultsResponse', () => {
  it('includes the empty results message', () => {
    const response = formatEmptyResultsResponse('密室诡计');
    expect(response).toContain(EMPTY_RESULTS_MESSAGE);
  });

  it('includes the original query', () => {
    const query = '什么是不在场证明诡计？';
    const response = formatEmptyResultsResponse(query);
    expect(response).toContain(query);
  });

  it('includes numbered suggestions', () => {
    const response = formatEmptyResultsResponse('test');
    for (let i = 0; i < QUERY_ADJUSTMENT_SUGGESTIONS.length; i++) {
      expect(response).toContain(`${i + 1}. ${QUERY_ADJUSTMENT_SUGGESTIONS[i]}`);
    }
  });

  it('handles empty query string', () => {
    const response = formatEmptyResultsResponse('');
    expect(response).toContain(EMPTY_RESULTS_MESSAGE);
    expect(response).toContain('""');
  });
});

// ---------------------------------------------------------------------------
// Tests: isOutOfScope
// ---------------------------------------------------------------------------

describe('isOutOfScope', () => {
  it('returns true for empty string', () => {
    expect(isOutOfScope('')).toBe(true);
  });

  it('returns true for whitespace-only string', () => {
    expect(isOutOfScope('   ')).toBe(true);
  });

  it('returns true when answer says no relevant info', () => {
    expect(isOutOfScope('当前知识库中没有相关信息。')).toBe(true);
  });

  it('returns true when answer says not found', () => {
    expect(isOutOfScope('没有找到相关的剧本杀知识。')).toBe(true);
  });

  it('returns true when answer says knowledge base lacks info', () => {
    expect(isOutOfScope('知识库中没有关于这个话题的内容。')).toBe(true);
  });

  it('returns true when answer says cannot answer', () => {
    expect(isOutOfScope('很抱歉，无法回答您的问题。')).toBe(true);
  });

  it('returns true when answer says out of scope', () => {
    expect(isOutOfScope('这个问题超出了知识库的范围。')).toBe(true);
  });

  it('returns true when answer says insufficient info', () => {
    expect(isOutOfScope('没有足够的信息来回答这个问题。')).toBe(true);
  });

  it('returns false for a normal answer with content', () => {
    expect(
      isOutOfScope(
        '密室诡计是一种常见的作案手法，通常利用密封空间制造不可能犯罪的假象。[来源: 迷雾庄园.pdf, 页码 5]',
      ),
    ).toBe(false);
  });

  it('returns false for a detailed answer about tricks', () => {
    expect(
      isOutOfScope(
        '不在场证明诡计的核心在于制造时间差，让凶手看似在案发时不在现场。',
      ),
    ).toBe(false);
  });
});
