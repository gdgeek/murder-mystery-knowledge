// ============================================================================
// Retrieval Pipeline LangGraph
//
// Receives a user query → analyzes intent → routes to structured/semantic/
// hybrid search → merges results → generates an LLM answer with citations.
//
// Requirements: 15.1, 15.2
// ============================================================================

import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import {
  analyzeIntent,
  type IntentAnalysisResult,
} from "./nodes/analyze-intent";
import { performStructuredSearch } from "./nodes/structured-search";
import { performSemanticSearch } from "./nodes/semantic-search";
import {
  mergeSearchResults,
  type SearchResult,
} from "./nodes/merge-results";
import {
  generateAnswer,
  type AnswerSource,
} from "./nodes/generate-answer";
import { getSessionHistory } from "../../services/chat";
import { formatEmptyResultsResponse, isOutOfScope } from "./empty-results";
import type { BaseMessage } from "@langchain/core/messages";

// ---------------------------------------------------------------------------
// State definition
// ---------------------------------------------------------------------------

export const RetrievalState = Annotation.Root({
  /** The user's query string. */
  query: Annotation<string>,
  /** Optional chat session ID for multi-turn context. */
  sessionId: Annotation<string | undefined>,

  // --- populated by analyzeIntentNode ---
  intentResult: Annotation<IntentAnalysisResult | undefined>,

  // --- populated by search nodes ---
  structuredResults: Annotation<SearchResult[]>,
  semanticResults: Annotation<SearchResult[]>,

  // --- populated by mergeNode ---
  mergedResults: Annotation<SearchResult[]>,

  // --- populated by generateNode ---
  answer: Annotation<string>,
  sources: Annotation<AnswerSource[]>,

  // --- populated by generateNode (internal) ---
  chatHistory: Annotation<BaseMessage[] | undefined>,
});

export type RetrievalStateType = typeof RetrievalState.State;

// ---------------------------------------------------------------------------
// Node functions
// ---------------------------------------------------------------------------

/**
 * Node 1 – Analyze Intent
 *
 * Uses LLM to classify the query as structured / semantic / hybrid and
 * extract any structured filter conditions.
 */
async function analyzeIntentNode(
  state: RetrievalStateType,
): Promise<Partial<RetrievalStateType>> {
  try {
    const intentResult = await analyzeIntent(state.query);
    return { intentResult };
  } catch (error) {
    console.error("[analyzeIntent] Failed to analyze intent:", error);
    throw error;
  }
}

/**
 * Node 2 – Route and Search
 *
 * Based on the queryType from intent analysis, executes the appropriate
 * search strategy:
 * - "structured": only structured search
 * - "semantic": only semantic search
 * - "hybrid": both searches in parallel
 */
async function routeAndSearchNode(
  state: RetrievalStateType,
): Promise<Partial<RetrievalStateType>> {
  try {
    const queryType = state.intentResult?.queryType ?? "semantic";

    let structuredResults: SearchResult[] = [];
    let semanticResults: SearchResult[] = [];

    if (queryType === "structured") {
      structuredResults = await performStructuredSearch({
        structuredFilters: state.intentResult?.structuredFilters,
      });
    } else if (queryType === "semantic") {
      semanticResults = await performSemanticSearch(
        state.intentResult?.semanticQuery ?? state.query,
      );
    } else {
      // hybrid – run both in parallel
      [structuredResults, semanticResults] = await Promise.all([
        performStructuredSearch({
          structuredFilters: state.intentResult?.structuredFilters,
        }),
        performSemanticSearch(
          state.intentResult?.semanticQuery ?? state.query,
        ),
      ]);
    }

    return { structuredResults, semanticResults };
  } catch (error) {
    console.error("[routeAndSearch] Search failed:", error);
    throw error;
  }
}

/**
 * Node 3 – Merge Results
 *
 * Combines structured and semantic search results using RRF.
 */
async function mergeNode(
  state: RetrievalStateType,
): Promise<Partial<RetrievalStateType>> {
  try {
    const mergedResults = mergeSearchResults(
      state.structuredResults ?? [],
      state.semanticResults ?? [],
    );
    return { mergedResults };
  } catch (error) {
    console.error("[merge] Failed to merge results:", error);
    throw error;
  }
}

/**
 * Node 4 – Generate Answer
 *
 * Loads chat history if a sessionId is provided, then uses GPT-4o to
 * generate an answer based on the merged search results. Handles empty
 * results and out-of-scope detection.
 */
async function generateNode(
  state: RetrievalStateType,
): Promise<Partial<RetrievalStateType>> {
  try {
    // Load chat history if session exists
    let chatHistory: BaseMessage[] | undefined;
    if (state.sessionId) {
      chatHistory = await getSessionHistory(state.sessionId);
    }

    // Handle empty results
    if (!state.mergedResults || state.mergedResults.length === 0) {
      const answer = formatEmptyResultsResponse(state.query);
      return { answer, sources: [], chatHistory };
    }

    // Generate answer with LLM
    const { answer, sources } = await generateAnswer(
      state.query,
      state.mergedResults,
      chatHistory,
    );

    return { answer, sources, chatHistory };
  } catch (error) {
    console.error("[generate] Failed to generate answer:", error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Graph assembly
// ---------------------------------------------------------------------------

const workflow = new StateGraph(RetrievalState)
  .addNode("analyzeIntent", analyzeIntentNode)
  .addNode("routeAndSearch", routeAndSearchNode)
  .addNode("merge", mergeNode)
  .addNode("generate", generateNode)
  .addEdge(START, "analyzeIntent")
  .addEdge("analyzeIntent", "routeAndSearch")
  .addEdge("routeAndSearch", "merge")
  .addEdge("merge", "generate")
  .addEdge("generate", END);

/**
 * Compiled Retrieval Pipeline graph.
 *
 * Usage:
 * ```ts
 * const result = await retrievalGraph.invoke({
 *   query: "找所有密室诡计",
 *   sessionId: "optional-session-uuid",
 * });
 * // result.answer – the generated answer string
 * // result.sources – citation sources
 * ```
 *
 * LangSmith tracing is automatically enabled when the environment variables
 * `LANGSMITH_API_KEY` and `LANGSMITH_PROJECT` are set.
 */
export const retrievalGraph = workflow.compile({
  name: "RetrievalPipeline",
});
