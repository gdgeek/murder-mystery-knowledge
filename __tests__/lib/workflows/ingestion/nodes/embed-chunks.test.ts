import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OpenAIEmbeddings } from "@langchain/openai";
import type { EmbedChunkInput } from "../../../../../lib/workflows/ingestion/nodes/embed-chunks";

// Mock the vector service before importing the module under test
vi.mock("../../../../../lib/services/vector", () => ({
  storeEmbedding: vi.fn().mockResolvedValue({}),
}));

// Mock @langchain/openai so the real constructor is never called
vi.mock("@langchain/openai", () => ({
  OpenAIEmbeddings: vi.fn(),
}));

import { embedChunks } from "../../../../../lib/workflows/ingestion/nodes/embed-chunks";
import { storeEmbedding } from "../../../../../lib/services/vector";

/** Helper: create a fake OpenAIEmbeddings instance. */
function makeFakeEmbeddings(dimension = 1536) {
  return {
    embedDocuments: vi.fn().mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => Array(dimension).fill(0.1))),
    ),
  } as unknown as OpenAIEmbeddings;
}

describe("embedChunks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Empty input ---

  it("returns empty processedIds for empty input", async () => {
    const result = await embedChunks([]);
    expect(result.processedIds).toEqual([]);
  });

  it("does not call storeEmbedding for empty input", async () => {
    await embedChunks([]);
    expect(storeEmbedding).not.toHaveBeenCalled();
  });

  // --- Single chunk ---

  it("processes a single chunk and returns its id", async () => {
    const chunks: EmbedChunkInput[] = [
      { id: "chunk-1", content: "Hello world" },
    ];
    const fakeEmbeddings = makeFakeEmbeddings();

    const result = await embedChunks(chunks, fakeEmbeddings);

    expect(result.processedIds).toEqual(["chunk-1"]);
  });

  it("calls embedDocuments with chunk contents", async () => {
    const chunks: EmbedChunkInput[] = [
      { id: "c1", content: "Text A" },
      { id: "c2", content: "Text B" },
    ];
    const fakeEmbeddings = makeFakeEmbeddings();

    await embedChunks(chunks, fakeEmbeddings);

    expect(fakeEmbeddings.embedDocuments).toHaveBeenCalledWith([
      "Text A",
      "Text B",
    ]);
  });

  it("calls storeEmbedding for each chunk", async () => {
    const chunks: EmbedChunkInput[] = [
      { id: "c1", content: "A" },
      { id: "c2", content: "B" },
      { id: "c3", content: "C" },
    ];
    const fakeEmbeddings = makeFakeEmbeddings();

    await embedChunks(chunks, fakeEmbeddings);

    expect(storeEmbedding).toHaveBeenCalledTimes(3);
    expect(storeEmbedding).toHaveBeenCalledWith("c1", expect.any(Array));
    expect(storeEmbedding).toHaveBeenCalledWith("c2", expect.any(Array));
    expect(storeEmbedding).toHaveBeenCalledWith("c3", expect.any(Array));
  });

  // --- Multiple chunks ---

  it("returns all chunk ids in order", async () => {
    const chunks: EmbedChunkInput[] = [
      { id: "a", content: "1" },
      { id: "b", content: "2" },
      { id: "c", content: "3" },
    ];
    const fakeEmbeddings = makeFakeEmbeddings();

    const result = await embedChunks(chunks, fakeEmbeddings);

    expect(result.processedIds).toEqual(["a", "b", "c"]);
  });

  // --- Error handling ---

  it("propagates embedding API errors", async () => {
    const chunks: EmbedChunkInput[] = [
      { id: "c1", content: "text" },
    ];
    const fakeEmbeddings = {
      embedDocuments: vi.fn().mockRejectedValue(new Error("API error")),
    } as unknown as OpenAIEmbeddings;

    await expect(embedChunks(chunks, fakeEmbeddings)).rejects.toThrow(
      "API error",
    );
  });

  it("propagates storeEmbedding errors", async () => {
    const chunks: EmbedChunkInput[] = [
      { id: "c1", content: "text" },
    ];
    const fakeEmbeddings = makeFakeEmbeddings();
    vi.mocked(storeEmbedding).mockRejectedValueOnce(new Error("DB error"));

    await expect(embedChunks(chunks, fakeEmbeddings)).rejects.toThrow(
      "DB error",
    );
  });

  // --- Return type shape ---

  it("result conforms to EmbedChunksResult interface", async () => {
    const chunks: EmbedChunkInput[] = [
      { id: "x", content: "content" },
    ];
    const fakeEmbeddings = makeFakeEmbeddings();

    const result = await embedChunks(chunks, fakeEmbeddings);

    expect(Array.isArray(result.processedIds)).toBe(true);
    for (const id of result.processedIds) {
      expect(typeof id).toBe("string");
    }
  });
});
