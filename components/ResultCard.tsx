"use client";

// ============================================================================
// ResultCard Component
//
// Displays a single search result with type badge, key data fields,
// source info (document name, page), and relevance score.
//
// Requirements: 14.5
// ============================================================================

// ============================================================================
// Types
// ============================================================================

export interface ResultSource {
  document_name?: string;
  page?: number;
  chunk_id?: string;
}

export interface ResultItem {
  type: string;
  data: Record<string, unknown>;
  source: ResultSource;
  score: number;
}

export interface ResultCardProps {
  item: ResultItem;
}

// ============================================================================
// Helpers
// ============================================================================

const TYPE_LABELS: Record<string, string> = {
  trick: "诡计",
  character: "角色",
  script_structure: "剧本结构",
  story_background: "故事背景",
  script_format: "剧本格式",
  player_script: "玩家剧本",
  clue: "线索",
  reasoning_chain: "推理链",
  misdirection: "误导手段",
  script_metadata: "剧本元数据",
  game_mechanics: "游戏机制",
  narrative_technique: "叙事技法",
  emotional_design: "情感设计",
  chunk: "文档片段",
};

const TYPE_COLORS: Record<string, string> = {
  trick: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  character: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  clue: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  misdirection: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  script_metadata: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  game_mechanics: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  chunk: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
};

const DEFAULT_COLOR = "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300";

/** Pick the most meaningful fields from data to display as a summary. */
function summarize(type: string, data: Record<string, unknown>): string {
  // Try common name/title fields first
  const name = data.name ?? data.title ?? data.character_name;
  const desc =
    data.mechanism ??
    data.motivation ??
    data.worldview ??
    data.description ??
    data.direction ??
    data.conclusion ??
    data.content;

  const parts: string[] = [];
  if (name) parts.push(String(name));
  if (desc) parts.push(String(desc).slice(0, 120));

  if (parts.length === 0) {
    // Fallback: show first string value
    for (const v of Object.values(data)) {
      if (typeof v === "string" && v.length > 0) {
        parts.push(v.slice(0, 120));
        break;
      }
    }
  }

  return parts.join(" — ") || "无摘要信息";
}

// ============================================================================
// Component
// ============================================================================

export default function ResultCard({ item }: ResultCardProps) {
  const typeLabel = TYPE_LABELS[item.type] ?? item.type;
  const colorClass = TYPE_COLORS[item.type] ?? DEFAULT_COLOR;
  const summary = summarize(item.type, item.data);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      {/* Header: type badge + score */}
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${colorClass}`}>
          {typeLabel}
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          相关度 {(item.score * 100).toFixed(0)}%
        </span>
      </div>

      {/* Summary */}
      <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed line-clamp-3">
        {summary}
      </p>

      {/* Source info */}
      {(item.source.document_name || item.source.page != null) && (
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <svg className="h-3.5 w-3.5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="truncate">
            {item.source.document_name ?? "未知文档"}
            {item.source.page != null && ` · 第 ${item.source.page} 页`}
          </span>
        </div>
      )}
    </div>
  );
}
