import { describe, it, expect } from "vitest";
import {
  chunkText,
  ChunkResult,
} from "../../../../../lib/workflows/ingestion/nodes/chunk-text";

describe("chunkText", () => {
  // --- Basic functionality ---

  it("returns chunks with correct filename", async () => {
    const text = "A".repeat(500);
    const result = await chunkText(text, "test.pdf", 1);

    expect(result.filename).toBe("test.pdf");
  });

  it("returns a single chunk for short text", async () => {
    const text = "This is a short document about a murder mystery.";
    const result = await chunkText(text, "short.pdf", 1);

    expect(result.chunks.length).toBe(1);
    expect(result.chunks[0].content).toBe(text);
    expect(result.chunks[0].chunk_index).toBe(0);
  });

  it("splits long text into multiple chunks", async () => {
    // Create text longer than chunk_size (1000)
    const text = "Word ".repeat(500); // ~2500 chars
    const result = await chunkText(text, "long.pdf", 5);

    expect(result.chunks.length).toBeGreaterThan(1);
  });

  it("assigns sequential chunk_index values starting from 0", async () => {
    const text = "Paragraph. ".repeat(200); // ~2200 chars
    const result = await chunkText(text, "doc.pdf", 3);

    for (let i = 0; i < result.chunks.length; i++) {
      expect(result.chunks[i].chunk_index).toBe(i);
    }
  });

  // --- Page range metadata ---

  it("assigns page_start=1 and page_end=1 for single-page document", async () => {
    const text = "Some content for a single page.";
    const result = await chunkText(text, "one-page.pdf", 1);

    expect(result.chunks[0].page_start).toBe(1);
    expect(result.chunks[0].page_end).toBe(1);
  });

  it("ensures page_start <= page_end for all chunks", async () => {
    const text = "Content block. ".repeat(300);
    const result = await chunkText(text, "multi.pdf", 10);

    for (const chunk of result.chunks) {
      expect(chunk.page_start).toBeLessThanOrEqual(chunk.page_end);
    }
  });

  it("ensures page_start >= 1 for all chunks", async () => {
    const text = "Data. ".repeat(300);
    const result = await chunkText(text, "doc.pdf", 5);

    for (const chunk of result.chunks) {
      expect(chunk.page_start).toBeGreaterThanOrEqual(1);
    }
  });

  it("ensures page_end <= pageCount for all chunks", async () => {
    const text = "Text segment. ".repeat(300);
    const result = await chunkText(text, "doc.pdf", 8);

    for (const chunk of result.chunks) {
      expect(chunk.page_end).toBeLessThanOrEqual(8);
    }
  });

  it("later chunks have page_start >= earlier chunks page_start", async () => {
    const text = "Section content here. ".repeat(300);
    const result = await chunkText(text, "ordered.pdf", 10);

    for (let i = 1; i < result.chunks.length; i++) {
      expect(result.chunks[i].page_start).toBeGreaterThanOrEqual(
        result.chunks[i - 1].page_start,
      );
    }
  });

  // --- Chunk content ---

  it("chunk content is non-empty", async () => {
    const text = "Hello world. ".repeat(200);
    const result = await chunkText(text, "doc.pdf", 3);

    for (const chunk of result.chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });

  it("preserves Chinese text content", async () => {
    const text = "剧本杀是一种推理游戏。".repeat(150);
    const result = await chunkText(text, "剧本.pdf", 2);

    expect(result.chunks.length).toBeGreaterThanOrEqual(1);
    expect(result.chunks[0].content).toContain("剧本杀");
  });

  // --- Edge cases ---

  it("handles text exactly at chunk_size boundary", async () => {
    const text = "X".repeat(1000);
    const result = await chunkText(text, "exact.pdf", 1);

    expect(result.chunks.length).toBe(1);
    expect(result.chunks[0].content).toBe(text);
  });

  it("handles very large page count", async () => {
    const text = "Content. ".repeat(200);
    const result = await chunkText(text, "big.pdf", 500);

    for (const chunk of result.chunks) {
      expect(chunk.page_start).toBeGreaterThanOrEqual(1);
      expect(chunk.page_end).toBeLessThanOrEqual(500);
    }
  });

  // --- Return type shape ---

  it("result conforms to ChunkResult interface", async () => {
    const text = "Test content for shape validation.";
    const result: ChunkResult = await chunkText(text, "shape.pdf", 1);

    expect(typeof result.filename).toBe("string");
    expect(Array.isArray(result.chunks)).toBe(true);
    for (const chunk of result.chunks) {
      expect(typeof chunk.content).toBe("string");
      expect(typeof chunk.page_start).toBe("number");
      expect(typeof chunk.page_end).toBe("number");
      expect(typeof chunk.chunk_index).toBe("number");
    }
  });
});
