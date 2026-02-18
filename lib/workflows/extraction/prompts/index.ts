// Re-export all prompt templates and pre-configured extractors
export { TRICK_PROMPT, extractTrick } from './trick';
export { CHARACTER_PROMPT, extractCharacter } from './character';
export { SCRIPT_STRUCTURE_PROMPT, extractScriptStructure } from './script-structure';
export { STORY_BACKGROUND_PROMPT, extractStoryBackground } from './story-background';
export { SCRIPT_FORMAT_PROMPT, extractScriptFormat } from './script-format';
export { PLAYER_SCRIPT_PROMPT, extractPlayerScript } from './player-script';
export { CLUE_PROMPT, extractClue } from './clue';
export { REASONING_CHAIN_PROMPT, extractReasoningChain } from './reasoning-chain';
export { MISDIRECTION_PROMPT, extractMisdirection } from './misdirection';
export { SCRIPT_METADATA_PROMPT, extractScriptMetadata } from './script-metadata';
export { GAME_MECHANICS_PROMPT, extractGameMechanics } from './game-mechanics';
export { NARRATIVE_TECHNIQUE_PROMPT, extractNarrativeTechnique } from './narrative-technique';
export { EMOTIONAL_DESIGN_PROMPT, extractEmotionalDesign } from './emotional-design';

// Extractor registry — maps entity type names to their pre-configured extractors
import { extractTrick } from './trick';
import { extractCharacter } from './character';
import { extractScriptStructure } from './script-structure';
import { extractStoryBackground } from './story-background';
import { extractScriptFormat } from './script-format';
import { extractPlayerScript } from './player-script';
import { extractClue } from './clue';
import { extractReasoningChain } from './reasoning-chain';
import { extractMisdirection } from './misdirection';
import { extractScriptMetadata } from './script-metadata';
import { extractGameMechanics } from './game-mechanics';
import { extractNarrativeTechnique } from './narrative-technique';
import { extractEmotionalDesign } from './emotional-design';

export const extractorRegistry = {
  trick: extractTrick,
  character: extractCharacter,
  script_structure: extractScriptStructure,
  story_background: extractStoryBackground,
  script_format: extractScriptFormat,
  player_script: extractPlayerScript,
  clue: extractClue,
  reasoning_chain: extractReasoningChain,
  misdirection: extractMisdirection,
  script_metadata: extractScriptMetadata,
  game_mechanics: extractGameMechanics,
  narrative_technique: extractNarrativeTechnique,
  emotional_design: extractEmotionalDesign,
} as const;

export type ExtractorType = keyof typeof extractorRegistry;
