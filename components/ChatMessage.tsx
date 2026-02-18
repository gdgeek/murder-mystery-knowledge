"use client";

// ============================================================================
// ChatMessage Component
//
// Renders a single chat message (user or assistant) with optional source
// citations. Assistant messages support streaming text display.
//
// Requirements: 14.3
// ============================================================================

export interface Source {
  title: string;
  page?: number;
  chunk_id?: string;
  score?: number;
}

export interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
}

export default function ChatMessage({
  role,
  content,
  sources,
  isStreaming,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
        }`}
      >
        {/* Message content */}
        <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">
          {content}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current align-middle" />
          )}
        </div>

        {/* Source citations */}
        {!isUser && sources && sources.length > 0 && (
          <div className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-700">
            <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              引用来源
            </p>
            <ul className="space-y-1">
              {sources.map((src, idx) => (
                <li
                  key={idx}
                  className="text-xs text-zinc-500 dark:text-zinc-400"
                >
                  <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {idx + 1}
                  </span>
                  {src.title}
                  {src.page != null && ` · 第 ${src.page} 页`}
                  {src.score != null && (
                    <span className="ml-1 text-zinc-400 dark:text-zinc-500">
                      ({(src.score * 100).toFixed(0)}%)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
