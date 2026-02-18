// ============================================================================
// Empty Results & Out-of-Scope Handling
//
// Utility module for handling empty search results and out-of-scope queries.
// Provides user-friendly messages with query adjustment suggestions, and
// detection of LLM answers that indicate the question is outside the
// knowledge base scope.
//
// Requirements: 12.5, 13.5
// ============================================================================

/**
 * Default message returned when no search results are found.
 */
export const EMPTY_RESULTS_MESSAGE =
  '抱歉，当前知识库中没有找到与您问题相关的信息。';

/**
 * Suggestions shown to the user when search results are empty.
 */
export const QUERY_ADJUSTMENT_SUGGESTIONS = [
  '尝试使用不同的关键词或更通用的描述',
  '检查是否有拼写错误',
  '尝试缩小查询范围，例如指定具体的剧本类型或诡计类型',
  '使用结构化检索条件进行精确筛选',
];

/**
 * Phrases that indicate the LLM's answer is about out-of-scope content.
 * These are patterns the LLM uses when it cannot find relevant info in context.
 */
const OUT_OF_SCOPE_INDICATORS = [
  '没有相关信息',
  '没有找到相关',
  '知识库中没有',
  '无法回答',
  '超出.*范围',
  '没有足够的信息',
  '不在.*知识库',
  '无相关信息',
  '未找到相关',
];

/**
 * Format a helpful response when search results are empty.
 * Includes the original query context and adjustment suggestions.
 */
export function formatEmptyResultsResponse(query: string): string {
  const suggestions = QUERY_ADJUSTMENT_SUGGESTIONS.map(
    (s, i) => `${i + 1}. ${s}`,
  ).join('\n');

  return `${EMPTY_RESULTS_MESSAGE}\n\n您的查询："${query}"\n\n建议您：\n${suggestions}`;
}

/**
 * Check whether the LLM's answer indicates the question is out of scope
 * (i.e. the knowledge base does not contain relevant information).
 */
export function isOutOfScope(answer: string): boolean {
  if (!answer || answer.trim().length === 0) return true;

  return OUT_OF_SCOPE_INDICATORS.some((pattern) =>
    new RegExp(pattern).test(answer),
  );
}
