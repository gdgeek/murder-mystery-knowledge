import { z } from "zod";

// ============================================================================
// Shared types
// ============================================================================

/** Confidence is a record mapping field names to numeric scores (0-1) */
const ConfidenceSchema = z.record(z.string(), z.number().min(0).max(1));

const ReviewStatusSchema = z
  .enum(["approved", "pending_review"])
  .default("pending_review");

/** document_id, chunk_id, and script_id are set during storage, not extraction */
const DocumentRefFields = {
  document_id: z.uuid().optional(),
  chunk_id: z.uuid().optional(),
  script_id: z.string().uuid().optional(),
} as const;

// ============================================================================
// Script (剧本 — 顶层聚合实体)
// ============================================================================

export const ScriptSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  created_at: z.string(),
});

export type Script = z.infer<typeof ScriptSchema>;

// ============================================================================
// Script Metadata (剧本元数据)
// ============================================================================

export const ScriptMetadataSchema = z.object({
  ...DocumentRefFields,
  title: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
  publish_year: z.number().int().nullable().optional(),
  min_players: z.number().int().nullable().optional(),
  max_players: z.number().int().nullable().optional(),
  duration_minutes: z.number().int().nullable().optional(),
  difficulty: z
    .enum(["beginner", "intermediate", "hardcore"])
    .nullable()
    .optional(),
  tags: z.array(z.string()).default([]),
  confidence: ConfidenceSchema.nullable().optional(),
  review_status: ReviewStatusSchema,
});

export type ScriptMetadata = z.infer<typeof ScriptMetadataSchema>;

// ============================================================================
// Trick (诡计)
// ============================================================================

export const TrickSchema = z.object({
  ...DocumentRefFields,
  name: z.string().nullable().optional(),
  type: z
    .enum([
      "locked_room",
      "alibi",
      "weapon_hiding",
      "poisoning",
      "disguise",
      "other",
    ])
    .nullable()
    .optional(),
  mechanism: z.string().nullable().optional(),
  key_elements: z.array(z.string()).default([]),
  weakness: z.string().nullable().optional(),
  confidence: ConfidenceSchema.nullable().optional(),
  review_status: ReviewStatusSchema,
});

export type Trick = z.infer<typeof TrickSchema>;

// ============================================================================
// Character (角色)
// ============================================================================

export const CharacterRelationshipSchema = z.object({
  related_character_name: z.string(),
  relationship_type: z.string(),
  description: z.string().nullable().optional(),
});

export type CharacterRelationship = z.infer<typeof CharacterRelationshipSchema>;

export const CharacterSchema = z.object({
  ...DocumentRefFields,
  name: z.string().nullable().optional(),
  role: z
    .enum(["murderer", "detective", "suspect", "victim", "npc"])
    .nullable()
    .optional(),
  motivation: z.string().nullable().optional(),
  personality_traits: z.array(z.string()).default([]),
  relationships: z.array(CharacterRelationshipSchema).default([]),
  confidence: ConfidenceSchema.nullable().optional(),
  review_status: ReviewStatusSchema,
});

export type Character = z.infer<typeof CharacterSchema>;

// ============================================================================
// Script Structure (剧本结构)
// ============================================================================

export const TimelineEventSchema = z.object({
  timestamp: z.string(),
  description: z.string(),
});

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const SceneSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export type Scene = z.infer<typeof SceneSchema>;

export const ActSchema = z.object({
  name: z.string(),
  theme: z.string(),
});

export type Act = z.infer<typeof ActSchema>;

export const ScriptStructureSchema = z.object({
  ...DocumentRefFields,
  timeline_events: z.array(TimelineEventSchema).default([]),
  scenes: z.array(SceneSchema).default([]),
  acts: z.array(ActSchema).default([]),
  confidence: ConfidenceSchema.nullable().optional(),
  review_status: ReviewStatusSchema,
});

export type ScriptStructure = z.infer<typeof ScriptStructureSchema>;

// ============================================================================
// Story Background (故事背景)
// ============================================================================

export const StoryBackgroundSchema = z.object({
  ...DocumentRefFields,
  era: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  worldview: z.string().nullable().optional(),
  social_environment: z.string().nullable().optional(),
  confidence: ConfidenceSchema.nullable().optional(),
  review_status: ReviewStatusSchema,
});

export type StoryBackground = z.infer<typeof StoryBackgroundSchema>;

// ============================================================================
// Script Format (剧本格式)
// ============================================================================

export const ActCompositionSchema = z.object({
  act_name: z.string(),
  act_theme: z.string(),
  components: z.array(z.string()).default([]),
});

export type ActComposition = z.infer<typeof ActCompositionSchema>;

export const ScriptFormatSchema = z.object({
  ...DocumentRefFields,
  act_count: z.number().int().nullable().optional(),
  has_separate_clue_book: z.boolean().nullable().optional(),
  has_public_info_page: z.boolean().nullable().optional(),
  layout_style: z.string().nullable().optional(),
  act_compositions: z.array(ActCompositionSchema).default([]),
  confidence: ConfidenceSchema.nullable().optional(),
  review_status: ReviewStatusSchema,
});

export type ScriptFormat = z.infer<typeof ScriptFormatSchema>;

// ============================================================================
// Player Script (玩家剧本)
// ============================================================================

export const PlayerScriptSectionSchema = z.object({
  section_name: z.string(),
  word_count: z.number().int(),
});

export type PlayerScriptSection = z.infer<typeof PlayerScriptSectionSchema>;

export const PlayerScriptSchema = z.object({
  ...DocumentRefFields,
  character_name: z.string().nullable().optional(),
  total_word_count: z.number().int().nullable().optional(),
  sections: z.array(PlayerScriptSectionSchema).default([]),
  confidence: ConfidenceSchema.nullable().optional(),
  review_status: ReviewStatusSchema,
});

export type PlayerScript = z.infer<typeof PlayerScriptSchema>;

// ============================================================================
// Clue (线索)
// ============================================================================

export const ClueSchema = z.object({
  ...DocumentRefFields,
  name: z.string().nullable().optional(),
  type: z
    .enum(["physical_evidence", "testimony", "document", "environmental"])
    .nullable()
    .optional(),
  location: z.string().nullable().optional(),
  direction: z.string().nullable().optional(),
  associated_characters: z.array(z.string()).default([]),
  confidence: ConfidenceSchema.nullable().optional(),
  review_status: ReviewStatusSchema,
});

export type Clue = z.infer<typeof ClueSchema>;

// ============================================================================
// Reasoning Chain (推理链)
// ============================================================================

export const ReasoningStepSchema = z.object({
  input_clues: z.array(z.string()).default([]),
  deduction: z.string(),
});

export type ReasoningStep = z.infer<typeof ReasoningStepSchema>;

export const ReasoningChainSchema = z.object({
  ...DocumentRefFields,
  name: z.string().nullable().optional(),
  steps: z.array(ReasoningStepSchema).default([]),
  conclusion: z.string().nullable().optional(),
  confidence: ConfidenceSchema.nullable().optional(),
  review_status: ReviewStatusSchema,
});

export type ReasoningChain = z.infer<typeof ReasoningChainSchema>;

// ============================================================================
// Misdirection (误导手段)
// ============================================================================

export const MisdirectionSchema = z.object({
  ...DocumentRefFields,
  name: z.string().nullable().optional(),
  type: z
    .enum([
      "false_clue",
      "time_misdirection",
      "identity_disguise",
      "motive_misdirection",
    ])
    .nullable()
    .optional(),
  target: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
  confidence: ConfidenceSchema.nullable().optional(),
  review_status: ReviewStatusSchema,
});

export type Misdirection = z.infer<typeof MisdirectionSchema>;

// ============================================================================
// Game Mechanics (游戏机制)
// ============================================================================

export const SpecialPhaseSchema = z.object({
  name: z.string(),
  rules: z.string(),
  trigger_timing: z.string(),
});

export type SpecialPhase = z.infer<typeof SpecialPhaseSchema>;

export const GameMechanicsSchema = z.object({
  ...DocumentRefFields,
  core_gameplay_type: z.string().nullable().optional(),
  special_phases: z.array(SpecialPhaseSchema).default([]),
  victory_conditions: z.record(z.string(), z.string()).nullable().optional(),
  confidence: ConfidenceSchema.nullable().optional(),
  review_status: ReviewStatusSchema,
});

export type GameMechanics = z.infer<typeof GameMechanicsSchema>;

// ============================================================================
// Narrative Technique (叙事技法)
// ============================================================================

export const SuspenseTechniqueSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export type SuspenseTechnique = z.infer<typeof SuspenseTechniqueSchema>;

export const ForeshadowingSchema = z.object({
  content: z.string(),
  echo_location: z.string(),
  effect: z.string(),
});

export type Foreshadowing = z.infer<typeof ForeshadowingSchema>;

export const NarrativeTechniqueSchema = z.object({
  ...DocumentRefFields,
  perspective: z
    .enum(["first_person", "third_person", "multi_perspective"])
    .nullable()
    .optional(),
  structure_type: z
    .enum(["linear", "nonlinear", "multi_threaded", "flashback"])
    .nullable()
    .optional(),
  suspense_techniques: z.array(SuspenseTechniqueSchema).default([]),
  foreshadowings: z.array(ForeshadowingSchema).default([]),
  confidence: ConfidenceSchema.nullable().optional(),
  review_status: ReviewStatusSchema,
});

export type NarrativeTechnique = z.infer<typeof NarrativeTechniqueSchema>;

// ============================================================================
// Emotional Design (情感设计)
// ============================================================================

export const EmotionalClimaxSchema = z.object({
  act_reference: z.string(),
  trigger_event: z.string(),
  target_emotion: z.string(),
});

export type EmotionalClimax = z.infer<typeof EmotionalClimaxSchema>;

export const EmotionalArcSchema = z.object({
  character_name: z.string(),
  phases: z.array(z.string()).default([]),
});

export type EmotionalArc = z.infer<typeof EmotionalArcSchema>;

export const EmotionalDesignSchema = z.object({
  ...DocumentRefFields,
  target_emotions: z.array(z.string()).default([]),
  emotional_climaxes: z.array(EmotionalClimaxSchema).default([]),
  emotional_arcs: z.array(EmotionalArcSchema).default([]),
  confidence: ConfidenceSchema.nullable().optional(),
  review_status: ReviewStatusSchema,
});

export type EmotionalDesign = z.infer<typeof EmotionalDesignSchema>;

// ============================================================================
// Schema registry — maps entity type names to their schemas
// ============================================================================

export const EntitySchemas = {
  trick: TrickSchema,
  character: CharacterSchema,
  script_structure: ScriptStructureSchema,
  story_background: StoryBackgroundSchema,
  script_format: ScriptFormatSchema,
  player_script: PlayerScriptSchema,
  clue: ClueSchema,
  reasoning_chain: ReasoningChainSchema,
  misdirection: MisdirectionSchema,
  script_metadata: ScriptMetadataSchema,
  game_mechanics: GameMechanicsSchema,
  narrative_technique: NarrativeTechniqueSchema,
  emotional_design: EmotionalDesignSchema,
} as const;

export type EntityType = keyof typeof EntitySchemas;

// Re-export shared schemas for external use
export { ConfidenceSchema, ReviewStatusSchema };
