import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks – declared before importing the module under test
// ---------------------------------------------------------------------------

const mockCreateSession = vi.fn();
const mockAddMessage = vi.fn();
const mockGetSessionHistory = vi.fn();

vi.mock("../../../../lib/services/chat", () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  addMessage: (...args: unknown[]) => mockAddMessage(...args),
  getSessionHistory: (...args: unknown[]) => mockGetSessionHistory(...args),
}));

const mockGraphInvoke = vi.fn();
vi.mock("../../../../lib/workflows/retrieval/graph", () => ({
  retrievalGraph: {
    invoke: (...args: unknown[]) => mockGraphInvoke(...args),
  },
}));

const mockGenerateAnswerStream = vi.fn();
vi.mock("../../../../lib/workflows/retrieval/nodes/generate-answer", () => ({
  generateAnswerStream: (...args: unknown[]) =>
    mockGenerateAnswerStream(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST } from "../../../../app/api/chat/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Create a simple ReadableStream that yields the given chunks then closes. */
function createMockStream(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

/** Read all SSE events from a Response body. */
async function readSSEEvents(response: Response): Promise<string[]> {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.replace("data: ", ""));
}

/** Parse SSE events into typed objects. */
async function parseSSEEvents(
  response: Response,
): Promise<Array<Record<string, unknown> | string>> {
  const events = await readSSEEvents(response);
  return events.map((e) => {
    if (e === "[DONE]") return e;
    try {
      return JSON.parse(e) as Record<string, unknown>;
    } catch {
      return e;
    }
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateSession.mockResolvedValue("new-session-id");
    mockAddMessage.mockResolvedValue({
      id: "msg-1",
      session_id: "session-1",
      role: "user",
      content: "test",
      sources: null,
      created_at: "2024-01-01T00:00:00Z",
    });
    mockGetSessionHistory.mockResolvedValue([]);
    mockGraphInvoke.mockResolvedValue({
      mergedResults: [
        {
          type: "chunk",
          data: "Some context",
          source: { document_name: "test.pdf", page_start: 1 },
          score: 0.9,
        },
      ],
    });
    mockGenerateAnswerStream.mockReturnValue({
      stream: createMockStream(["Hello", " world"]),
      sources: [{ document_name: "test.pdf", page_start: 1 }],
    });
  });

  // --- Happy path: new session ---

  it("creates a new session when no session_id is provided", async () => {
    const req = createRequest({ message: "What is a locked room trick?" });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    expect(mockCreateSession).toHaveBeenCalled();
  });

  it("returns SSE content-type headers", async () => {
    const req = createRequest({ message: "Hello" });
    const res = await POST(req as any);

    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("streams session_id, chunks, sources, and DONE events", async () => {
    const req = createRequest({ message: "Tell me about tricks" });
    const res = await POST(req as any);
    const events = await parseSSEEvents(res);

    // session_id event
    const sessionEvent = events.find(
      (e) => typeof e === "object" && e.type === "session_id",
    ) as Record<string, unknown>;
    expect(sessionEvent).toBeDefined();
    expect(sessionEvent.session_id).toBe("new-session-id");

    // chunk events
    const chunkEvents = events.filter(
      (e) => typeof e === "object" && e.type === "chunk",
    );
    expect(chunkEvents).toHaveLength(2);
    expect((chunkEvents[0] as Record<string, unknown>).content).toBe("Hello");
    expect((chunkEvents[1] as Record<string, unknown>).content).toBe(" world");

    // sources event
    const sourcesEvent = events.find(
      (e) => typeof e === "object" && e.type === "sources",
    ) as Record<string, unknown>;
    expect(sourcesEvent).toBeDefined();
    expect(sourcesEvent.sources).toEqual([
      { document_name: "test.pdf", page_start: 1 },
    ]);

    // DONE event
    expect(events[events.length - 1]).toBe("[DONE]");
  });

  // --- Happy path: existing session ---

  it("uses existing session_id when provided", async () => {
    const req = createRequest({
      message: "Follow up question",
      session_id: "existing-session",
    });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockAddMessage).toHaveBeenCalledWith(
      "existing-session",
      "user",
      "Follow up question",
    );
  });

  // --- Message storage ---

  it("stores user message before invoking pipeline", async () => {
    const req = createRequest({ message: "Test message" });
    await POST(req as any);

    expect(mockAddMessage).toHaveBeenCalledWith(
      "new-session-id",
      "user",
      "Test message",
    );
    // Pipeline should be called after message storage
    expect(mockGraphInvoke).toHaveBeenCalled();
  });

  it("stores assistant response after streaming completes", async () => {
    const req = createRequest({ message: "Test" });
    const res = await POST(req as any);

    // Consume the stream to trigger the assistant message storage
    await res.text();

    // Second call to addMessage should be for the assistant
    expect(mockAddMessage).toHaveBeenCalledTimes(2);
    expect(mockAddMessage).toHaveBeenLastCalledWith(
      "new-session-id",
      "assistant",
      "Hello world",
      [{ document_name: "test.pdf", page_start: 1 }],
    );
  });

  // --- Chat history ---

  it("loads chat history and passes it to generateAnswerStream", async () => {
    const mockHistory = [{ content: "previous message" }];
    mockGetSessionHistory.mockResolvedValueOnce(mockHistory);

    const req = createRequest({
      message: "Follow up",
      session_id: "session-with-history",
    });
    const res = await POST(req as any);
    await res.text();

    expect(mockGetSessionHistory).toHaveBeenCalledWith(
      "session-with-history",
    );
    expect(mockGenerateAnswerStream).toHaveBeenCalledWith(
      "Follow up",
      expect.any(Array),
      mockHistory,
    );
  });

  // --- Retrieval pipeline integration ---

  it("invokes retrieval pipeline with query and sessionId", async () => {
    const req = createRequest({
      message: "Find locked room tricks",
      session_id: "my-session",
    });
    const res = await POST(req as any);
    await res.text();

    expect(mockGraphInvoke).toHaveBeenCalledWith({
      query: "Find locked room tricks",
      sessionId: "my-session",
    });
  });

  it("handles empty merged results from pipeline", async () => {
    mockGraphInvoke.mockResolvedValueOnce({ mergedResults: [] });
    mockGenerateAnswerStream.mockReturnValueOnce({
      stream: createMockStream(["No results found"]),
      sources: [],
    });

    const req = createRequest({ message: "Unknown topic" });
    const res = await POST(req as any);
    const events = await parseSSEEvents(res);

    const chunkEvents = events.filter(
      (e) => typeof e === "object" && e.type === "chunk",
    );
    expect(chunkEvents).toHaveLength(1);
    expect((chunkEvents[0] as Record<string, unknown>).content).toBe(
      "No results found",
    );
  });

  // --- Validation errors ---

  it("returns 400 when message is missing", async () => {
    const req = createRequest({});
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_MESSAGE");
  });

  it("returns 400 when message is empty string", async () => {
    const req = createRequest({ message: "" });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_MESSAGE");
  });

  it("returns 400 when message is whitespace only", async () => {
    const req = createRequest({ message: "   " });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_MESSAGE");
  });

  it("returns 400 when message is not a string", async () => {
    const req = createRequest({ message: 123 });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_MESSAGE");
  });

  // --- Error handling ---

  it("returns 500 when session creation fails", async () => {
    mockCreateSession.mockRejectedValueOnce(new Error("DB connection failed"));

    const req = createRequest({ message: "Hello" });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.error).toContain("DB connection failed");
  });

  it("returns 500 when pipeline invocation fails", async () => {
    mockGraphInvoke.mockRejectedValueOnce(new Error("Pipeline error"));

    const req = createRequest({ message: "Hello" });
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("sends error event in SSE when streaming fails", async () => {
    const errorStream = new ReadableStream<string>({
      start(controller) {
        controller.error(new Error("Stream broke"));
      },
    });
    mockGenerateAnswerStream.mockReturnValueOnce({
      stream: errorStream,
      sources: [],
    });

    const req = createRequest({ message: "Hello" });
    const res = await POST(req as any);
    const events = await parseSSEEvents(res);

    const errorEvent = events.find(
      (e) => typeof e === "object" && e.type === "error",
    ) as Record<string, unknown>;
    expect(errorEvent).toBeDefined();
    expect(errorEvent.error).toContain("Stream broke");

    // Should still end with DONE
    expect(events[events.length - 1]).toBe("[DONE]");
  });

  // --- Message trimming ---

  it("trims whitespace from message before processing", async () => {
    const req = createRequest({ message: "  Hello world  " });
    const res = await POST(req as any);
    await res.text();

    expect(mockAddMessage).toHaveBeenCalledWith(
      "new-session-id",
      "user",
      "Hello world",
    );
    expect(mockGraphInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ query: "Hello world" }),
    );
  });
});
