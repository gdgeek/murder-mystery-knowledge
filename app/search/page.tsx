"use client";

// ============================================================================
// Search Page
//
// Combines SearchFilters and ResultCard to provide a structured search
// interface. Sends requests to POST /api/search and displays results.
//
// Requirements: 14.4, 14.5
// ============================================================================

import { useState } from "react";
import SearchFilters, { type SearchFiltersValues } from "@/components/SearchFilters";
import ResultCard, { type ResultItem } from "@/components/ResultCard";

// ============================================================================
// Helpers
// ============================================================================

/** Convert form values into the API request body. */
function buildRequestBody(values: SearchFiltersValues) {
  const body: Record<string, unknown> = {};

  if (values.query.trim()) {
    body.query = values.query.trim();
  }

  const filters: Record<string, unknown> = {};

  if (values.trick_type) filters.trick_type = values.trick_type;
  if (values.character_identity) filters.character_identity = values.character_identity;
  if (values.era.trim()) filters.era = values.era.trim();
  if (values.act_count) filters.act_count = Number(values.act_count);
  if (values.clue_type) filters.clue_type = values.clue_type;
  if (values.misdirection_type) filters.misdirection_type = values.misdirection_type;
  if (values.player_count) filters.player_count = Number(values.player_count);
  if (values.play_type.trim()) filters.play_type = values.play_type.trim();
  if (values.narrative_structure_type) filters.narrative_structure_type = values.narrative_structure_type;

  if (values.word_count_min || values.word_count_max) {
    const range: Record<string, number> = {};
    if (values.word_count_min) range.min = Number(values.word_count_min);
    if (values.word_count_max) range.max = Number(values.word_count_max);
    filters.word_count_range = range;
  }

  if (values.script_type_tags.trim()) {
    filters.script_type_tags = values.script_type_tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  if (Object.keys(filters).length > 0) {
    body.filters = filters;
  }

  return body;
}

// ============================================================================
// Component
// ============================================================================

export default function SearchPage() {
  const [results, setResults] = useState<ResultItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (values: SearchFiltersValues) => {
    const body = buildRequestBody(values);

    // Require at least one condition
    if (!body.query && !body.filters) {
      setError("请至少输入一个查询条件或筛选项");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "搜索失败，请稍后重试");
        setResults([]);
        setTotal(null);
        return;
      }

      setResults(data.items ?? []);
      setTotal(data.total ?? 0);
      setMessage(data.message ?? null);
    } catch {
      setError("网络错误，请稍后重试");
      setResults([]);
      setTotal(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 md:p-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          结构化检索
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
          按多维度条件筛选剧本杀知识库，支持结构化查询与自然语言混合检索
        </p>

        {/* Filters panel */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 mb-8">
          <SearchFilters onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Results section */}
        {total !== null && (
          <div className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            共找到 {total} 条结果
          </div>
        )}

        {/* Empty results message */}
        {message && results.length === 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
          </div>
        )}

        {/* Result cards */}
        {results.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((item, idx) => (
              <ResultCard key={idx} item={item} />
            ))}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">正在搜索…</span>
          </div>
        )}
      </div>
    </div>
  );
}
