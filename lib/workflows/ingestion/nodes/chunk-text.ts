import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { ChunkInput } from "../../../services/document";

/** Configuration for the text chunking process. */
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

/** Result of chunking a document's text, including filename metadata. */
export interface ChunkResult {
  /** The filename of the source document. */
  filename: string;
  /** Array of chunks ready for storage. */
  chunks: ChunkInput[];
}

/**
 * Split document text into semantic chunks with page-range metadata.
 *
 * Uses LangChain RecursiveCharacterTextSplitter with chunk_size=1000 and
 * chunk_overlap=200. Each chunk is annotated with estimated page_start and
 * page_end based on the chunk's position within the full text.
 *
 * @param text      Full extracted text from the PDF
 * @param filename  Original filename of the source document
 * @param pageCount Total number of pages in the source PDF
 * @returns ChunkResult containing filename and an array of ChunkInput objects
 *
 * Validates: Requirements 1.3
 */
export async function chunkText(
  text: string,
  filename: string,
  pageCount: number,
): Promise<ChunkResult> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  const docs = await splitter.createDocuments([text]);

  const totalLength = text.length;

  const chunks: ChunkInput[] = docs.map((doc, index) => {
    // Find the position of this chunk's content within the original text.
    // Use indexOf starting from a reasonable offset to handle overlapping chunks.
    const chunkStart = text.indexOf(doc.pageContent);
    const chunkEnd = chunkStart === -1
      ? totalLength
      : chunkStart + doc.pageContent.length;

    // Estimate page range based on character position ratio.
    // Pages are 1-indexed.
    const pageStart = Math.max(
      1,
      Math.floor((Math.max(0, chunkStart) / totalLength) * pageCount) + 1,
    );
    const pageEnd = Math.max(
      pageStart,
      Math.min(
        pageCount,
        Math.ceil((chunkEnd / totalLength) * pageCount),
      ),
    );

    return {
      content: doc.pageContent,
      page_start: pageStart,
      page_end: pageEnd,
      chunk_index: index,
    };
  });

  return { filename, chunks };
}
