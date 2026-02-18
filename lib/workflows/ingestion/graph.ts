import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { parsePdf } from "./nodes/parse-pdf";
import { chunkText } from "./nodes/chunk-text";
import { embedChunks } from "./nodes/embed-chunks";
import {
  createDocument,
  updateDocumentStatus,
  createChunks,
} from "../../services/document";
import type { EmbedChunkInput } from "./nodes/embed-chunks";

// ---------------------------------------------------------------------------
// State definition
// ---------------------------------------------------------------------------

/**
 * Annotation-based state for the Ingestion Pipeline.
 *
 * Each node reads from and writes to this shared state. Fields use the
 * default "last value" reducer so every write simply replaces the previous
 * value.
 */
export const IngestionState = Annotation.Root({
  /** Raw PDF file content. */
  pdfBuffer: Annotation<Buffer>,
  /** Original filename of the uploaded PDF. */
  filename: Annotation<string>,
  /** Optional script ID to associate the document with. */
  scriptId: Annotation<string | undefined>,

  // --- populated by parsePdfNode ---
  /** Full extracted text from the PDF. */
  text: Annotation<string>,
  /** Total number of pages in the PDF. */
  pageCount: Annotation<number>,
  /** Document row ID created in the database. */
  documentId: Annotation<string>,

  // --- populated by chunkTextNode ---
  /** Chunk IDs returned after inserting into document_chunks table. */
  chunkIds: Annotation<string[]>,

  // --- populated by embedChunksNode ---
  /** IDs of chunks whose embeddings were successfully stored. */
  processedIds: Annotation<string[]>,
});

export type IngestionStateType = typeof IngestionState.State;

// ---------------------------------------------------------------------------
// Node functions
// ---------------------------------------------------------------------------

/**
 * Node 1 – Parse PDF
 *
 * Validates the buffer, extracts text, creates a document record in the DB,
 * and updates its status to "parsing".
 */
async function parsePdfNode(
  state: IngestionStateType,
): Promise<Partial<IngestionStateType>> {
  const { text, pageCount } = await parsePdf(state.pdfBuffer, state.filename);

  // Create the document record and mark status as "parsing"
  const doc = await createDocument(state.filename, "", state.scriptId);
  await updateDocumentStatus(doc.id, "parsing");

  return {
    text,
    pageCount,
    documentId: doc.id,
  };
}

/**
 * Node 2 – Chunk Text
 *
 * Splits the extracted text into semantic chunks, persists them to the
 * document_chunks table, and updates the document status to "chunking".
 */
async function chunkTextNode(
  state: IngestionStateType,
): Promise<Partial<IngestionStateType>> {
  await updateDocumentStatus(state.documentId, "chunking");

  const { chunks } = await chunkText(state.text, state.filename, state.pageCount);

  // Persist chunks to DB
  const savedChunks = await createChunks(state.documentId, chunks);
  const chunkIds = savedChunks.map((c: { id: string }) => c.id);

  return { chunkIds };
}

/**
 * Node 3 – Embed Chunks
 *
 * Generates embeddings for every chunk and stores them in pgvector.
 * Updates the document status to "embedding" then "completed".
 */
async function embedChunksNode(
  state: IngestionStateType,
): Promise<Partial<IngestionStateType>> {
  await updateDocumentStatus(state.documentId, "embedding");

  // Build input for the embed function
  // We need chunk content – re-read is avoided by building from chunkIds.
  // However the embed node needs (id, content) pairs. We fetch them from DB.
  const { getChunksByDocumentId } = await import("../../services/document");
  const dbChunks = await getChunksByDocumentId(state.documentId);

  const embedInput: EmbedChunkInput[] = dbChunks.map(
    (c: { id: string; content: string }) => ({
      id: c.id,
      content: c.content,
    }),
  );

  const { processedIds } = await embedChunks(embedInput);

  await updateDocumentStatus(state.documentId, "completed");

  return { processedIds };
}

// ---------------------------------------------------------------------------
// Graph assembly
// ---------------------------------------------------------------------------

const workflow = new StateGraph(IngestionState)
  .addNode("parsePdf", parsePdfNode)
  .addNode("chunkText", chunkTextNode)
  .addNode("embedChunks", embedChunksNode)
  .addEdge(START, "parsePdf")
  .addEdge("parsePdf", "chunkText")
  .addEdge("chunkText", "embedChunks")
  .addEdge("embedChunks", END);

/**
 * Compiled Ingestion Pipeline graph.
 *
 * Usage:
 * ```ts
 * const result = await ingestionGraph.invoke({
 *   pdfBuffer: buffer,
 *   filename: "script.pdf",
 * });
 * ```
 *
 * LangSmith tracing is automatically enabled when the environment variables
 * `LANGSMITH_API_KEY` and `LANGSMITH_PROJECT` are set.
 */
export const ingestionGraph = workflow.compile({
  name: "IngestionPipeline",
});
