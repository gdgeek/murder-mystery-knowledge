"use client";

// ============================================================================
// SearchFilters Component
//
// Renders a filter panel with select dropdowns and text inputs for all
// structured search dimensions, plus a natural language query input.
//
// Requirements: 14.4
// ============================================================================

import { useState, type FormEvent } from "react";

// ============================================================================
// Types
// ============================================================================

export interface SearchFiltersValues {
  query: string;
  trick_type: string;
  character_identity: string;
  era: string;
  act_count: string;
  word_count_min: string;
  word_count_max: string;
  clue_type: string;
  misdirection_type: string;
  script_type_tags: string;
  player_count: string;
  play_type: string;
  narrative_structure_type: string;
}

export interface SearchFiltersProps {
  onSearch: (filters: SearchFiltersValues) => void;
  isLoading?: boolean;
}

// ============================================================================
// Filter option definitions
// ============================================================================

const TRICK_TYPES = [
  { value: "", label: "全部" },
  { value: "locked_room", label: "密室" },
  { value: "alibi", label: "不在场证明" },
  { value: "weapon_hiding", label: "凶器隐藏" },
  { value: "poisoning", label: "毒杀" },
  { value: "disguise", label: "伪装" },
  { value: "other", label: "其他" },
];

const CHARACTER_IDENTITIES = [
  { value: "", label: "全部" },
  { value: "murderer", label: "凶手" },
  { value: "detective", label: "侦探" },
  { value: "suspect", label: "嫌疑人" },
  { value: "victim", label: "受害者" },
  { value: "npc", label: "NPC" },
];

const CLUE_TYPES = [
  { value: "", label: "全部" },
  { value: "physical_evidence", label: "物证" },
  { value: "testimony", label: "证言" },
  { value: "document", label: "文件" },
  { value: "environmental", label: "环境线索" },
];

const MISDIRECTION_TYPES = [
  { value: "", label: "全部" },
  { value: "false_clue", label: "虚假线索" },
  { value: "time_misdirection", label: "时间误导" },
  { value: "identity_disguise", label: "身份伪装" },
  { value: "motive_misdirection", label: "动机误导" },
];

const NARRATIVE_STRUCTURES = [
  { value: "", label: "全部" },
  { value: "linear", label: "线性" },
  { value: "nonlinear", label: "非线性" },
  { value: "multi_threaded", label: "多线交织" },
  { value: "flashback", label: "倒叙" },
];

// ============================================================================
// Component
// ============================================================================

const INITIAL_VALUES: SearchFiltersValues = {
  query: "",
  trick_type: "",
  character_identity: "",
  era: "",
  act_count: "",
  word_count_min: "",
  word_count_max: "",
  clue_type: "",
  misdirection_type: "",
  script_type_tags: "",
  player_count: "",
  play_type: "",
  narrative_structure_type: "",
};

export default function SearchFilters({ onSearch, isLoading }: SearchFiltersProps) {
  const [values, setValues] = useState<SearchFiltersValues>(INITIAL_VALUES);

  const set = (key: keyof SearchFiltersValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setValues((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(values);
  };

  const handleReset = () => {
    setValues(INITIAL_VALUES);
  };

  const selectClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-400";
  const inputClass = selectClass;
  const labelClass = "block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="结构化检索筛选">
      {/* Natural language query */}
      <div>
        <label htmlFor="search-query" className={labelClass}>自然语言查询</label>
        <input
          id="search-query"
          type="text"
          value={values.query}
          onChange={set("query")}
          placeholder="输入自然语言描述…"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Trick type */}
        <div>
          <label htmlFor="filter-trick-type" className={labelClass}>诡计类型</label>
          <select id="filter-trick-type" value={values.trick_type} onChange={set("trick_type")} className={selectClass}>
            {TRICK_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Character identity */}
        <div>
          <label htmlFor="filter-character-identity" className={labelClass}>角色身份</label>
          <select id="filter-character-identity" value={values.character_identity} onChange={set("character_identity")} className={selectClass}>
            {CHARACTER_IDENTITIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Era */}
        <div>
          <label htmlFor="filter-era" className={labelClass}>时代设定</label>
          <input id="filter-era" type="text" value={values.era} onChange={set("era")} placeholder="如：民国、现代" className={inputClass} />
        </div>

        {/* Act count */}
        <div>
          <label htmlFor="filter-act-count" className={labelClass}>幕数</label>
          <input id="filter-act-count" type="number" min="1" value={values.act_count} onChange={set("act_count")} placeholder="如：3" className={inputClass} />
        </div>

        {/* Word count range */}
        <div>
          <label htmlFor="filter-word-min" className={labelClass}>字数范围（最小）</label>
          <input id="filter-word-min" type="number" min="0" value={values.word_count_min} onChange={set("word_count_min")} placeholder="最小字数" className={inputClass} />
        </div>
        <div>
          <label htmlFor="filter-word-max" className={labelClass}>字数范围（最大）</label>
          <input id="filter-word-max" type="number" min="0" value={values.word_count_max} onChange={set("word_count_max")} placeholder="最大字数" className={inputClass} />
        </div>

        {/* Clue type */}
        <div>
          <label htmlFor="filter-clue-type" className={labelClass}>线索类型</label>
          <select id="filter-clue-type" value={values.clue_type} onChange={set("clue_type")} className={selectClass}>
            {CLUE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Misdirection type */}
        <div>
          <label htmlFor="filter-misdirection-type" className={labelClass}>误导类型</label>
          <select id="filter-misdirection-type" value={values.misdirection_type} onChange={set("misdirection_type")} className={selectClass}>
            {MISDIRECTION_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Script type tags */}
        <div>
          <label htmlFor="filter-script-tags" className={labelClass}>剧本类型标签</label>
          <input id="filter-script-tags" type="text" value={values.script_type_tags} onChange={set("script_type_tags")} placeholder="逗号分隔，如：硬核推理,情感沉浸" className={inputClass} />
        </div>

        {/* Player count */}
        <div>
          <label htmlFor="filter-player-count" className={labelClass}>适合人数</label>
          <input id="filter-player-count" type="number" min="1" value={values.player_count} onChange={set("player_count")} placeholder="如：6" className={inputClass} />
        </div>

        {/* Play type */}
        <div>
          <label htmlFor="filter-play-type" className={labelClass}>玩法类型</label>
          <input id="filter-play-type" type="text" value={values.play_type} onChange={set("play_type")} placeholder="如：推理投凶" className={inputClass} />
        </div>

        {/* Narrative structure type */}
        <div>
          <label htmlFor="filter-narrative-structure" className={labelClass}>叙事结构</label>
          <select id="filter-narrative-structure" value={values.narrative_structure_type} onChange={set("narrative_structure_type")} className={selectClass}>
            {NARRATIVE_STRUCTURES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? "搜索中…" : "搜索"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={isLoading}
          className="rounded-lg border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          重置
        </button>
      </div>
    </form>
  );
}
