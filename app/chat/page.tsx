"use client";

// ============================================================================
// Chat Page
//
// Provides a chat interface for interacting with the murder mystery knowledge
// base. Sends messages to POST /api/chat and streams the SSE response in
// real-time, displaying source citations when available.
//
// Requirements: 14.3
// ============================================================================

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import ChatMessage, { type Source } from "@/components/ChatMessage";
import { parseSSEBuffer } from "@/lib/utils/parse-sse";

// ============================================================================
// Types
// ============================================================================

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

// ============================================================================
// Component
// ============================================================================

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ---- Send message and handle SSE stream ----
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
      };

      // Placeholder for the assistant response
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            session_id: sessionId,
          }),
        });

        if (!res.ok || !res.body) {
          const errData = await res.json().catch(() => null);
          const errText = errData?.error ?? "请求失败，请稍后重试";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: errText } : m,
            ),
          );
          setIsLoading(false);
          return;
        }

        // Parse SSE stream
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;

          buffer += decoder.decode(value, { stream: true });
          const { events, done: sseDone, remaining } = parseSSEBuffer(buffer);
          buffer = remaining;

          for (const evt of events) {
            if (evt.type === "session_id") {
              setSessionId(evt.session_id);
            } else if (evt.type === "chunk") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: m.content + evt.content }
                    : m,
                ),
              );
            } else if (evt.type === "sources") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, sources: evt.sources as Source[] }
                    : m,
                ),
              );
            } else if (evt.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: m.content || evt.error }
                    : m,
                ),
              );
            }
          }

          if (sseDone) break;
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: m.content || "网络错误，请稍后重试" }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sessionId],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ---- Render ----
  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="flex-none border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          剧本杀知识库问答
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          基于知识库的智能问答，支持多轮对话
        </p>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              输入问题开始对话
            </p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            sources={msg.sources}
            isStreaming={
              isLoading &&
              msg.role === "assistant" &&
              idx === messages.length - 1
            }
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-none border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900 md:px-8">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题…"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
            aria-label="聊天输入框"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="发送消息"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 12h14M12 5l7 7-7 7"
                />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
