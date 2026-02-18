"use client";

import { useState, useEffect, useCallback } from "react";

interface ScriptItem {
  id: string;
  name: string;
  description: string | null;
  document_count: number;
}

interface ScriptSelectorProps {
  onSelect: (scriptId: string | null) => void;
  selectedScriptId?: string | null;
}

const CREATE_NEW = "__create_new__";

export default function ScriptSelector({
  onSelect,
  selectedScriptId = null,
}: ScriptSelectorProps) {
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScripts = useCallback(async () => {
    try {
      const res = await fetch("/api/scripts");
      if (res.ok) {
        const data = await res.json();
        setScripts(data.items ?? []);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const handleSelectChange = (value: string) => {
    if (value === CREATE_NEW) {
      setShowForm(true);
      setError(null);
    } else {
      setShowForm(false);
      onSelect(value || null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("剧本名称不能为空");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, description: description.trim() || undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "创建失败");
        return;
      }

      // Refresh list and select the new script
      await fetchScripts();
      setShowForm(false);
      setName("");
      setDescription("");
      onSelect(data.id);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setCreating(false);
    }
  };

  const selectValue = showForm ? CREATE_NEW : selectedScriptId ?? "";

  return (
    <div className="space-y-3">
      <label
        htmlFor="script-select"
        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        选择剧本
      </label>

      <select
        id="script-select"
        value={selectValue}
        onChange={(e) => handleSelectChange(e.target.value)}
        disabled={loading}
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">不选择剧本</option>
        {scripts.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}（{s.document_count} 个文档）
          </option>
        ))}
        <option value={CREATE_NEW}>＋ 新建剧本</option>
      </select>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3"
        >
          <div>
            <label
              htmlFor="script-name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              剧本名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="script-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入剧本名称"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="script-description"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              描述（可选）
            </label>
            <input
              id="script-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入剧本描述"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "创建中…" : "创建剧本"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
                onSelect(selectedScriptId ?? null);
              }}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
