// ============================================================================
// Extraction Pipeline LangGraph
//
// Reads document chunks → runs all 13 entity extractors per chunk →
// evaluates confidence → stores results in the relational database.
//
// Requirements: 15.1, 15.2, 15.3
// ============================================================================

import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { getChunksByDocumentId, getDocument, updateDocumentStatus } from "../../services/document";
import { extractorRegistry, type ExtractorType } from "./prompts";
import { evaluateConfidence } from "./confidence";
import {
  storeExtractionResults,
  type StoreInput,
  type StoredRecord,
} from "./nodes/store-results";
import type { ExtractionResult } from "./extractor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChunkExtractionResult {
  chunkId: string;
  entityType: ExtractorType;
  data: Record<string, unknown>;
  confidence: Record<string, number>;
  review_status: "approved" | "pending_review";
}

// ---------------------------------------------------------------------------
// State definition
// ---------------------------------------------------------------------------

export const ExtractionState = Annotation.Root({
  /** The document to extract from. */
  documentId: Annotation<string>,

  /** The script this document belongs to (looked up from the document record). */
  scriptId: Annotation<string | null | undefined>,

  /** Document chunks loaded from the database. */
  chunks: Annotation<Array<{ id: string; content: string }>>,

  /** All extraction results across chunks and entity types. */
  extractionResults: Annotation<ChunkExtractionResult[]>,

  /** Records stored in the database after the store step. */
  storedRecords: Annotation<StoredRecord[]>,
});

export type ExtractionStateType = typeof ExtractionState.State;

// ---------------------------------------------------------------------------
// All entity types to extract
// ---------------------------------------------------------------------------

const ALL_ENTITY_TYPES: ExtractorType[] = Object.keys(
  extractorRegistry,
) as ExtractorType[];

// ---------------------------------------------------------------------------
// Node functions
// ---------------------------------------------------------------------------

/**
 * Node 1 – Load Chunks
 *
 * Fetches all document chunks from the database and updates the document
 * status to "extracting".
 */
async function loadChunksNode(
  state: ExtractionStateType,
): Promise<Partial<ExtractionStateType>> {
  try {
    await updateDocumentStatus(state.documentId, "extracting");

    const dbChunks = await getChunksByDocumentId(state.documentId);
    const chunks = dbChunks.map((c: { id: string; content: string }) => ({
      id: c.id,
      content: c.content,
    }));

    // Look up script_id from the document record if not already provided
    let scriptId = state.scriptId;
    if (scriptId === undefined) {
      try {
        const doc = await getDocument(state.documentId);
        scriptId = doc?.script_id ?? null;
      } catch {
        scriptId = null;
      }
    }

    return { chunks, scriptId };
  } catch (error) {
    console.error("[loadChunks] Failed to load chunks:", error);
    throw error;
  }
}

/**
 * Node 2 – Extract All
 *
 * For each chunk, runs all 13 entity extractors. Extraction is sequential
 * per chunk but all entity types are attempted for each chunk. Individual
 * extractor failures are caught and logged — they do not abort the pipeline.
 */
async function extractAllNode(
  state: ExtractionStateType,
): Promise<Partial<ExtractionStateType>> {
  const results: ChunkExtractionResult[] = [];

  for (const chunk of state.chunks) {
    // Run all extractors for this chunk in parallel
    const extractionPromises = ALL_ENTITY_TYPES.map(async (entityType) => {
      try {
        const extractor = extractorRegistry[entityType];
        const result: ExtractionResult<Record<string, unknown>> =
          await extractor(chunk.content);

        return {
          chunkId: chunk.id,
          entityType,
          data: result.data as Record<string, unknown>,
          confidence: result.confidence,
          review_status: result.review_status,
        } satisfies ChunkExtractionResult;
      } catch (error) {
        console.error(
          `[extractAll] Failed to extract ${entityType} from chunk ${chunk.id}:`,
          error,
        );
        return null;
      }
    });

    const chunkResults = await Promise.all(extractionPromises);

    for (const r of chunkResults) {
      if (r !== null) {
        results.push(r);
      }
    }
  }

  return { extractionResults: results };
}

/**
 * Node 3 – Evaluate All
 *
 * Applies confidence evaluation to every extraction result, ensuring
 * review_status is correctly computed from the confidence scores.
 */
async function evaluateAllNode(
  state: ExtractionStateType,
): Promise<Partial<ExtractionStateType>> {
  try {
    const evaluated = state.extractionResults.map((result) => {
      const input = {
        ...result.data,
        confidence: result.confidence,
        review_status: result.review_status,
      };
      const enriched = evaluateConfidence(input);

      return {
        ...result,
        data: enriched,
        review_status: enriched.review_status ?? result.review_status,
      } as ChunkExtractionResult;
    });

    return { extractionResults: evaluated };
  } catch (error) {
    console.error("[evaluateAll] Failed to evaluate confidence:", error);
    throw error;
  }
}

/**
 * Node 4 – Store All
 *
 * Persists all extraction results into the relational database via
 * storeExtractionResults.
 */
async function storeAllNode(
  state: ExtractionStateType,
): Promise<Partial<ExtractionStateType>> {
  try {
    const storeInputs: StoreInput[] = state.extractionResults.map((r) => ({
      entityType: r.entityType,
      data: r.data,
      documentId: state.documentId,
      chunkId: r.chunkId,
      scriptId: state.scriptId,
    }));

    const storedRecords = await storeExtractionResults(storeInputs);

    return { storedRecords };
  } catch (error) {
    console.error("[storeAll] Failed to store extraction results:", error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Graph assembly
// ---------------------------------------------------------------------------

const workflow = new StateGraph(ExtractionState)
  .addNode("loadChunks", loadChunksNode)
  .addNode("extractAll", extractAllNode)
  .addNode("evaluateAll", evaluateAllNode)
  .addNode("storeAll", storeAllNode)
  .addEdge(START, "loadChunks")
  .addEdge("loadChunks", "extractAll")
  .addEdge("extractAll", "evaluateAll")
  .addEdge("evaluateAll", "storeAll")
  .addEdge("storeAll", END);

/**
 * Compiled Extraction Pipeline graph.
 *
 * Usage:
 * ```ts
 * const result = await extractionGraph.invoke({
 *   documentId: "uuid-of-document",
 * });
 * ```
 *
 * LangSmith tracing is automatically enabled when the environment variables
 * `LANGSMITH_API_KEY` and `LANGSMITH_PROJECT` are set.
 */
export const extractionGraph = workflow.compile({
  name: "ExtractionPipeline",
});
