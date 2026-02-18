import { describe, it, expect } from "vitest";
import { parseSSEBuffer, type SSEEvent } from "../../../lib/utils/parse-sse";

describe("parseSSEBuffer", () => {
  it("parses chunk events", () => {
    const buffer = 'data: {"type":"chunk","content":"Hello"}\n\n';
    const { events, done, remaining } = parseSSEBuffer(buffer);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "chunk", content: "Hello" });
    expect(done).toBe(false);
    expect(remaining).toBe("");
  });

  it("parses session_id events", () => {
    const buffer = 'data: {"type":"session_id","session_id":"abc-123"}\n\n';
    const { events } = parseSSEBuffer(buffer);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "session_id", session_id: "abc-123" });
  });

  it("parses sources events", () => {
    const sources = [
      { title: "test.pdf", page: 5, score: 0.9 },
      { title: "other.pdf", page: 12 },
    ];
    const buffer = `data: ${JSON.stringify({ type: "sources", sources })}\n\n`;
    const { events } = parseSSEBuffer(buffer);

    expect(events).toHaveLength(1);
    const evt = events[0] as Extract<SSEEvent, { type: "sources" }>;
    expect(evt.type).toBe("sources");
    expect(evt.sources).toEqual(sources);
  });

  it("parses error events", () => {
    const buffer = 'data: {"type":"error","error":"Something went wrong"}\n\n';
    const { events } = parseSSEBuffer(buffer);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "error",
      error: "Something went wrong",
    });
  });

  it("detects [DONE] signal", () => {
    const buffer = "data: [DONE]\n\n";
    const { events, done } = parseSSEBuffer(buffer);

    expect(events).toHaveLength(0);
    expect(done).toBe(true);
  });

  it("parses multiple events in a single buffer", () => {
    const buffer = [
      'data: {"type":"session_id","session_id":"s1"}',
      "",
      'data: {"type":"chunk","content":"Hi"}',
      "",
      'data: {"type":"chunk","content":" there"}',
      "",
      "",
    ].join("\n");

    const { events, done } = parseSSEBuffer(buffer);

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: "session_id", session_id: "s1" });
    expect(events[1]).toEqual({ type: "chunk", content: "Hi" });
    expect(events[2]).toEqual({ type: "chunk", content: " there" });
    expect(done).toBe(false);
  });

  it("stops parsing at [DONE] and ignores subsequent events", () => {
    const buffer = [
      'data: {"type":"chunk","content":"before"}',
      "",
      "data: [DONE]",
      "",
      'data: {"type":"chunk","content":"after"}',
      "",
      "",
    ].join("\n");

    const { events, done } = parseSSEBuffer(buffer);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "chunk", content: "before" });
    expect(done).toBe(true);
  });

  it("preserves incomplete trailing data as remaining", () => {
    const buffer = 'data: {"type":"chunk","content":"Hi"}\ndata: {"type":"ch';
    const { events, remaining } = parseSSEBuffer(buffer);

    expect(events).toHaveLength(1);
    expect(remaining).toBe('data: {"type":"ch');
  });

  it("skips malformed JSON lines", () => {
    const buffer = [
      "data: not-json",
      "",
      'data: {"type":"chunk","content":"ok"}',
      "",
      "",
    ].join("\n");

    const { events } = parseSSEBuffer(buffer);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "chunk", content: "ok" });
  });

  it("skips non-data lines", () => {
    const buffer = [
      ": comment line",
      "event: message",
      'data: {"type":"chunk","content":"ok"}',
      "",
      "",
    ].join("\n");

    const { events } = parseSSEBuffer(buffer);

    expect(events).toHaveLength(1);
  });

  it("returns empty results for empty buffer", () => {
    const { events, done, remaining } = parseSSEBuffer("");

    expect(events).toHaveLength(0);
    expect(done).toBe(false);
    expect(remaining).toBe("");
  });

  it("handles buffer with only newlines", () => {
    const { events, done } = parseSSEBuffer("\n\n\n");

    expect(events).toHaveLength(0);
    expect(done).toBe(false);
  });
});
