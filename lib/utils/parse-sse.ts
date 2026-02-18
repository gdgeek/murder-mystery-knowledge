// ============================================================================
// SSE Event Parser
//
// Parses Server-Sent Events from the chat API response stream.
// Extracted for testability and reuse.
// ============================================================================

export interface SSEChunkEvent {
  type: "chunk";
  content: string;
}

export interface SSESourcesEvent {
  type: "sources";
  sources: Array<{
    title: string;
    page?: number;
    chunk_id?: string;
    score?: number;
  }>;
}

export interface SSESessionEvent {
  type: "session_id";
  session_id: string;
}

export interface SSEErrorEvent {
  type: "error";
  error: string;
}

export type SSEEvent =
  | SSEChunkEvent
  | SSESourcesEvent
  | SSESessionEvent
  | SSEErrorEvent;

export interface ParseResult {
  events: SSEEvent[];
  done: boolean;
  remaining: string;
}

/**
 * Parse a buffer of SSE data into typed events.
 *
 * Returns parsed events, whether [DONE] was encountered, and any
 * remaining unparsed data (incomplete lines).
 */
export function parseSSEBuffer(buffer: string): ParseResult {
  const events: SSEEvent[] = [];
  let done = false;

  const lines = buffer.split("\n");
  const remaining = lines.pop() ?? "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) continue;

    const payload = trimmed.slice(6);

    if (payload === "[DONE]") {
      done = true;
      break;
    }

    try {
      const evt = JSON.parse(payload) as SSEEvent;
      if (evt && typeof evt === "object" && "type" in evt) {
        events.push(evt);
      }
    } catch {
      // skip malformed JSON
    }
  }

  return { events, done, remaining };
}
