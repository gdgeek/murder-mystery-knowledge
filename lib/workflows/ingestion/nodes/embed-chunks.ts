import { OpenAIEmbeddings } from "@langchain/openai";
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
 * Uses OpenAI `text-embedding-3-small` to generate 1536-dimensional vectors,
 * then stores each embedding via the vector service.
 *
 * @param chunks Array of chunks with id and content
 * @param embeddings Optional OpenAIEmbeddings instance (for dependency injection in tests)
 * @returns The IDs of all successfully processed chunks
 *
 * Validates: Requirements 1.4
 */
export async function embedChunks(
  chunks: EmbedChunkInput[],
  embeddings?: OpenAIEmbeddings,
): Promise<EmbedChunksResult> {
  if (chunks.length === 0) {
    return { processedIds: [] };
  }

  const model =
    embeddings ??
    new OpenAIEmbeddings({ model: "text-embedding-3-small" });

  const texts = chunks.map((c) => c.content);
  const vectors = await model.embedDocuments(texts);

  const processedIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    await storeEmbedding(chunks[i].id, vectors[i]);
    processedIds.push(chunks[i].id);
  }

  return { processedIds };
}
