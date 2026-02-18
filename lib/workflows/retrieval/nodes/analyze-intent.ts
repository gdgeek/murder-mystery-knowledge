// ============================================================================
// Analyze Intent Node
//
// Uses LLM to classify user queries into structured / semantic / hybrid,
// and extracts structured filter conditions when applicable.
//
// Requirements: 13.1
// ============================================================================

import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// ============================================================================
// Schema
// ============================================================================

export const IntentAnalysisResultSchema = z.object({
  queryType: z.enum(["structured", "semantic", "hybrid"]),
  structuredFilters: z
    .object({
      entity_type: z
        .enum([
          "trick",
          "character",
          "script_structure",
          "story_background",
          "script_format",
          "player_script",
          "clue",
          "reasoning_chain",
          "misdirection",
          "script_metadata",
          "game_mechanics",
          "narrative_technique",
          "emotional_design",
        ])
        .optional(),
      type: z.string().optional(),
      role: z.string().optional(),
      era: z.string().optional(),
      difficulty: z.string().optional(),
      core_gameplay_type: z.string().optional(),
      structure_type: z.string().optional(),
      perspective: z.string().optional(),
      min_players: z.number().int().optional(),
      max_players: z.number().int().optional(),
    })
    .optional(),
  semanticQuery: z.string().optional(),
});

export type IntentAnalysisResult = z.infer<typeof IntentAnalysisResultSchema>;

// ============================================================================
// Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a query intent analyzer for a murder mystery (剧本杀) knowledge base.

Your job is to analyze the user's query and determine:
1. The query type: "structured", "semantic", or "hybrid"
2. Any structured filter conditions that can be extracted
3. The semantic search portion of the query (if any)

QUERY TYPE RULES:
- "structured": The query asks for specific filterable attributes (e.g., "找所有密室诡计", "列出所有侦探角色", "难度为硬核的剧本")
- "semantic": The query is a natural language question seeking understanding (e.g., "如何设计一个好的推理链", "什么样的叙事结构最吸引人")
- "hybrid": The query combines specific filters with a semantic question (e.g., "密室诡计中最巧妙的机关设计是什么", "民国时代的剧本有哪些独特的叙事手法")

STRUCTURED FILTER FIELDS:
- entity_type: The type of entity being queried (trick, character, script_metadata, etc.)
- type: For tricks (locked_room, alibi, weapon_hiding, poisoning, disguise, other), clues (physical_evidence, testimony, document, environmental), misdirections (false_clue, time_misdirection, identity_disguise, motive_misdirection)
- role: For characters (murderer, detective, suspect, victim, npc)
- era: For story backgrounds (e.g., "民国", "现代", "古代")
- difficulty: For script metadata (beginner, intermediate, hardcore)
- core_gameplay_type: For game mechanics (e.g., "推理投凶", "阵营对抗")
- structure_type: For narrative techniques (linear, nonlinear, multi_threaded, flashback)
- perspective: For narrative techniques (first_person, third_person, multi_perspective)
- min_players / max_players: For script metadata player count filters

Only include structuredFilters when there are clear filterable conditions.
Only include semanticQuery when there is a natural language component that needs semantic search.`;

// ============================================================================
// Core function
// ============================================================================

export interface AnalyzeIntentOptions {
  modelName?: string;
  temperature?: number;
}

/**
 * Analyze user query intent to determine the retrieval strategy.
 *
 * Returns the query type (structured / semantic / hybrid), any extracted
 * structured filters, and the semantic query portion.
 */
export async function analyzeIntent(
  query: string,
  options: AnalyzeIntentOptions = {},
): Promise<IntentAnalysisResult> {
  const { modelName = "gpt-4o", temperature = 0 } = options;

  const llm = new ChatOpenAI({ modelName, temperature });
  const structuredLlm = llm.withStructuredOutput(IntentAnalysisResultSchema, {
    name: "analyze_query_intent",
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPT],
    ["human", "Analyze the following query:\n\n{query}"],
  ]);

  const chain = prompt.pipe(structuredLlm);
  const result = await chain.invoke({ query });

  return result;
}
