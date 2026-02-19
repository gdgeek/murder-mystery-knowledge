// ============================================================================
// Generate Answer Node
//
// Takes search results as context and uses GPT-4o to generate an answer
// with source citations. Supports both regular and streaming output.
//
// Requirements: 13.1, 13.2, 13.3
// ============================================================================

import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createChatModel } from '../../../ai/provider';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { BaseMessage } from '@langchain/core/messages';
import type { SearchResult } from '../../../services/utils';

// ============================================================================
// Types
// ============================================================================

export interface AnswerSource {
  document_name: string;
  page_start?: number;
  page_end?: number;
}

export interface GenerateAnswerResult {
  answer: string;
  sources: AnswerSource[];
}

export interface GenerateAnswerOptions {
  modelName?: string;
  temperature?: number;
}

// ============================================================================
// Prompt
// ============================================================================

const SYSTEM_PROMPT = `你是一个剧本杀知识库助手。请根据以下检索到的知识库内容回答用户的问题。

规则：
1. 仅基于提供的上下文内容回答，不要编造信息。
2. 在回答中引用信息来源时，使用 [来源: 剧本名, 页码] 的格式标注。如果没有页码信息，使用 [来源: 剧本名] 的格式。
3. 如果上下文中没有足够的信息来回答问题，请明确告知用户当前知识库中没有相关信息。
4. 回答应当准确、专业，并尽可能全面。

检索到的上下文内容：
{context}`;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a context string from search results, including source info.
 */
export function buildContext(results: SearchResult[]): string {
  if (results.length === 0) return '';

  return results
    .map((r, i) => {
      const src = r.source;
      const pageInfo =
        src.page_start != null
          ? src.page_end != null && src.page_end !== src.page_start
            ? ` (页码 ${src.page_start}-${src.page_end})`
            : ` (页码 ${src.page_start})`
          : '';
      const header = `[${i + 1}] 来源: ${src.document_name}${pageInfo}`;
      const data =
        typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2);
      return `${header}\n${data}`;
    })
    .join('\n\n');
}

/**
 * Extract unique sources from search results.
 */
export function extractSources(results: SearchResult[]): AnswerSource[] {
  const seen = new Set<string>();
  const sources: AnswerSource[] = [];

  for (const r of results) {
    const key = `${r.source.document_name}|${r.source.page_start ?? ''}|${r.source.page_end ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      sources.push({
        document_name: r.source.document_name,
        ...(r.source.page_start != null && { page_start: r.source.page_start }),
        ...(r.source.page_end != null && { page_end: r.source.page_end }),
      });
    }
  }

  return sources;
}

/**
 * Build the chat prompt messages including optional chat history.
 */
function buildMessages(
  query: string,
  context: string,
  chatHistory?: BaseMessage[],
) {
  const messages: Array<['system' | 'human' | 'ai', string] | ['placeholder', string]> = [
    ['system', SYSTEM_PROMPT],
  ];

  if (chatHistory && chatHistory.length > 0) {
    messages.push(['placeholder', '{chat_history}']);
  }

  messages.push(['human', '{query}']);

  return { messages, context, query, chatHistory };
}

// ============================================================================
// Core functions
// ============================================================================

const NO_RESULTS_MESSAGE =
  '抱歉，当前知识库中没有找到与您问题相关的信息。请尝试调整查询条件或换一种方式提问。';

/**
 * Generate an answer based on search results using GPT-4o.
 *
 * When search results are empty, returns a "no results found" message
 * without calling the LLM.
 */
export async function generateAnswer(
  query: string,
  searchResults: SearchResult[],
  chatHistory?: BaseMessage[],
  options: GenerateAnswerOptions = {},
): Promise<GenerateAnswerResult> {
  if (searchResults.length === 0) {
    return { answer: NO_RESULTS_MESSAGE, sources: [] };
  }

  const { temperature = 0.3 } = options;
  const context = buildContext(searchResults);
  const sources = extractSources(searchResults);

  const llm = await createChatModel("chat", { temperature });
  const { messages } = buildMessages(query, context, chatHistory);

  const prompt = ChatPromptTemplate.fromMessages(messages);
  const chain = prompt.pipe(llm).pipe(new StringOutputParser());

  const invokeParams: Record<string, unknown> = { context, query };
  if (chatHistory && chatHistory.length > 0) {
    invokeParams.chat_history = chatHistory;
  }

  const answer = await chain.invoke(invokeParams);

  return { answer, sources };
}

/**
 * Generate an answer as a ReadableStream for streaming output.
 *
 * When search results are empty, returns a stream that yields a single
 * "no results found" message chunk.
 */
export function generateAnswerStream(
  query: string,
  searchResults: SearchResult[],
  chatHistory?: BaseMessage[],
  options: GenerateAnswerOptions = {},
): { stream: ReadableStream<string>; sources: AnswerSource[] } {
  if (searchResults.length === 0) {
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(NO_RESULTS_MESSAGE);
        controller.close();
      },
    });
    return { stream, sources: [] };
  }

  const { temperature = 0.3 } = options;
  const context = buildContext(searchResults);
  const sources = extractSources(searchResults);

  const { messages } = buildMessages(query, context, chatHistory);

  const stream = new ReadableStream<string>({
    async start(controller) {
      try {
        const llm = await createChatModel("chat", { temperature });
        const prompt = ChatPromptTemplate.fromMessages(messages);
        const chain = prompt.pipe(llm).pipe(new StringOutputParser());

        const invokeParams: Record<string, unknown> = { context, query };
        if (chatHistory && chatHistory.length > 0) {
          invokeParams.chat_history = chatHistory;
        }

        const streamResult = await chain.stream(invokeParams);

        for await (const chunk of streamResult) {
          controller.enqueue(chunk);
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return { stream, sources };
}
