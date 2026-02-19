import { Embeddings } from "@langchain/core/embeddings";
import { createEmbeddings } from "../../../ai/provider";
import { storeEmbedding } from "../../../services/vector";

/** Input chunk for embedding generation. */
export interface EmbedChunkInput {
  /** Chunk ID (from document_chunks table). */
  id: string;
  /** Text content to embed. */
  content: string;
}

/** Result of the embedding process. */
export interface EmbedChunksResult {
  /** IDs of chunks that were successfully processed. */
  processedIds: string[];
}

/**
 * Generate embeddings for document chunks and store them in Supabase pgvector.
 *
 * Uses the configured Embedding provider to generate vectors,
 * then stores each embedding via the vector service.
 *
 * @param chunks Array of chunks with id and content
 * @param embeddings Optional Embeddings instance (for dependency injection in tests)
 * @returns The IDs of all successfully processed chunks
 *
 * Validates: Requirements 1.4
 */
export async function embedChunks(
  chunks: EmbedChunkInput[],
  embeddings?: Embeddings,
): Promise<EmbedChunksResult> {
  if (chunks.length === 0) {
    return { processedIds: [] };
  }

  const model =
    embeddings ??
    await createEmbeddings();

  const texts = chunks.map((c) => c.content);
  const vectors = await model.embedDocuments(texts);

  const processedIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    await storeEmbedding(chunks[i].id, vectors[i]);
    processedIds.push(chunks[i].id);
  }

  return { processedIds };
}
