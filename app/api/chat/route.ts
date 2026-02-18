// ============================================================================
// Chat API Route (SSE Streaming)
//
// Accepts a user message and optional session_id, invokes the Retrieval
// Pipeline, and streams the response back using Server-Sent Events.
//
// Requirements: 13.1, 13.2
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createSession, addMessage, getSessionHistory } from "@/lib/services/chat";
import { retrievalGraph } from "@/lib/workflows/retrieval/graph";
import { generateAnswerStream } from "@/lib/workflows/retrieval/nodes/generate-answer";

// ============================================================================
// Types
// ============================================================================

interface ChatRequestBody {
  message: string;
  session_id?: string;
}

// ============================================================================
// POST /api/chat
// ============================================================================

/**
 * POST /api/chat
 *
 * Accepts JSON body with `message` (string) and optional `session_id`.
 * If no session_id is provided, creates a new session.
 *
 * Runs the retrieval pipeline to get search results, then streams the
 * LLM-generated answer back via Server-Sent Events (SSE).
 *
 * SSE format:
 *   data: {"type":"chunk","content":"..."}\n\n   – for each text chunk
 *   data: {"type":"sources","sources":[...]}\n\n  – source citations
 *   data: {"type":"session_id","session_id":"..."}\n\n – session info
 *   data: [DONE]\n\n                                   – end of stream
 */
export async function POST(request: NextRequest) {
  try {
    // --- Parse and validate request body ---
    const body = (await request.json()) as ChatRequestBody;

    if (!body.message || typeof body.message !== "string" || body.message.trim().length === 0) {
      return NextResponse.json(
        { error: "消息内容不能为空", code: "MISSING_MESSAGE" },
        { status: 400 },
      );
    }

    const message = body.message.trim();

    // --- Session management ---
    let sessionId = body.session_id;
    if (!sessionId) {
      sessionId = await createSession();
    }

    // --- Store user message ---
    await addMessage(sessionId, "user", message);

    // --- Load chat history ---
    const chatHistory = await getSessionHistory(sessionId);

    // --- Run retrieval pipeline (intent analysis + search + merge) ---
    const pipelineResult = await retrievalGraph.invoke({
      query: message,
      sessionId,
    });

    const mergedResults = pipelineResult.mergedResults ?? [];

    // --- Stream the answer via SSE ---
    const { stream: answerStream, sources } = generateAnswerStream(
      message,
      mergedResults,
      chatHistory,
    );

    const encoder = new TextEncoder();
    let fullAnswer = "";

    const sseStream = new ReadableStream({
      async start(controller) {
        try {
          // Send session_id first so the client knows which session to use
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "session_id", session_id: sessionId })}\n\n`),
          );

          // Stream answer chunks
          const reader = answerStream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            fullAnswer += value;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "chunk", content: value })}\n\n`),
            );
          }

          // Send sources
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`),
          );

          // Send done signal
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));

          // Store assistant response after streaming completes
          await addMessage(
            sessionId!,
            "assistant",
            fullAnswer,
            sources.map((s) => ({ ...s })),
          );

          controller.close();
        } catch (error) {
          // Send error event before closing
          const errorMessage = error instanceof Error ? error.message : "流式响应生成失败";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "未知错误";

    return NextResponse.json(
      { error: message, code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
