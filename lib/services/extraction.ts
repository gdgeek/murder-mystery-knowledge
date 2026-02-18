import { supabase } from '../supabase';
import type { EntityType } from '../schemas';
import { computeReviewStatus } from './utils';
export { computeReviewStatus } from './utils';

// ============================================================================
// Generic upsert helpers
// ============================================================================

/**
 * Table name mapping from EntityType to the actual Postgres table name.
 */
const TABLE_MAP: Record<EntityType, string> = {
  trick: 'tricks',
  character: 'characters',
  script_structure: 'script_structures',
  story_background: 'story_backgrounds',
  script_format: 'script_formats',
  player_script: 'player_scripts',
  clue: 'clues',
  reasoning_chain: 'reasoning_chains',
  misdirection: 'misdirections',
  script_metadata: 'script_metadata',
  game_mechanics: 'game_mechanics',
  narrative_technique: 'narrative_techniques',
  emotional_design: 'emotional_designs',
};

// ============================================================================
// Nested-data child table definitions
// ============================================================================

interface ChildTableDef {
  table: string;
  foreignKey: string;
  /** The field name on the parent entity that holds the array of child rows */
  sourceField: string;
}

const CHILD_TABLES: Partial<Record<EntityType, ChildTableDef[]>> = {
  script_metadata: [
    { table: 'script_metadata_tags', foreignKey: 'script_metadata_id', sourceField: 'tags' },
  ],
  character: [
    // character_relationships are handled specially (need related_character_id lookup)
  ],
  script_structure: [
    { table: 'timeline_events', foreignKey: 'script_structure_id', sourceField: 'timeline_events' },
    { table: 'scenes', foreignKey: 'script_structure_id', sourceField: 'scenes' },
    { table: 'acts', foreignKey: 'script_structure_id', sourceField: 'acts' },
  ],
  script_format: [
    { table: 'act_compositions', foreignKey: 'script_format_id', sourceField: 'act_compositions' },
  ],
  player_script: [
    { table: 'player_script_sections', foreignKey: 'player_script_id', sourceField: 'sections' },
  ],
  reasoning_chain: [
    { table: 'reasoning_steps', foreignKey: 'reasoning_chain_id', sourceField: 'steps' },
  ],
  game_mechanics: [
    { table: 'special_phases', foreignKey: 'game_mechanics_id', sourceField: 'special_phases' },
  ],
  narrative_technique: [
    { table: 'suspense_techniques', foreignKey: 'narrative_technique_id', sourceField: 'suspense_techniques' },
    { table: 'foreshadowings', foreignKey: 'narrative_technique_id', sourceField: 'foreshadowings' },
  ],
  emotional_design: [
    { table: 'emotional_climaxes', foreignKey: 'emotional_design_id', sourceField: 'emotional_climaxes' },
    { table: 'emotional_arcs', foreignKey: 'emotional_design_id', sourceField: 'emotional_arcs' },
  ],
};

// ============================================================================
// Upsert entity
// ============================================================================

/**
 * Insert a structured entity into the database.
 *
 * - Computes review_status from confidence scores
 * - Inserts the main row into the entity table
 * - Inserts any nested child rows into their respective tables
 * - For script_metadata tags, converts string[] to {tag: string}[] rows
 * - For timeline_events and acts, adds sort_order
 * - For reasoning_chain steps, adds step_order
 *
 * Returns the inserted parent row (with id).
 */
export async function upsertEntity(
  entityType: EntityType,
  data: Record<string, unknown>,
  documentId: string,
  chunkId?: string,
  scriptId?: string | null,
) {
  const table = TABLE_MAP[entityType];
  const reviewStatus = computeReviewStatus(
    data.confidence as Record<string, number> | null | undefined,
  );

  // Build the main row — strip out nested array fields that go to child tables
  const childDefs = CHILD_TABLES[entityType] ?? [];
  const nestedFieldNames = new Set(childDefs.map((c) => c.sourceField));

  const mainRow: Record<string, unknown> = { review_status: reviewStatus };

  // script_metadata uses document_id only (no chunk_id)
  if (entityType === 'script_metadata') {
    mainRow.document_id = documentId;
  } else {
    mainRow.document_id = documentId;
    if (chunkId) mainRow.chunk_id = chunkId;
  }

  // Write script_id when provided
  if (scriptId) {
    mainRow.script_id = scriptId;
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === 'review_status') continue; // we compute it
    if (key === 'document_id' || key === 'chunk_id') continue; // set above
    if (key === 'script_id') continue; // set above
    if (nestedFieldNames.has(key)) continue; // handled as child rows
    // character relationships handled separately
    if (entityType === 'character' && key === 'relationships') continue;
    mainRow[key] = value;
  }

  const { data: inserted, error } = await supabase
    .from(table)
    .insert(mainRow)
    .select()
    .single();

  if (error) throw error;
  const parentId = (inserted as Record<string, unknown>).id as string;

  // Insert child rows
  for (const childDef of childDefs) {
    const childData = data[childDef.sourceField];
    if (!Array.isArray(childData) || childData.length === 0) continue;

    let childRows: Record<string, unknown>[];

    if (childDef.table === 'script_metadata_tags') {
      // tags is string[] → convert to {script_metadata_id, tag}[]
      childRows = (childData as string[]).map((tag) => ({
        [childDef.foreignKey]: parentId,
        tag,
      }));
    } else if (childDef.table === 'timeline_events' || childDef.table === 'acts') {
      // Add sort_order
      childRows = (childData as Record<string, unknown>[]).map((row, i) => ({
        [childDef.foreignKey]: parentId,
        ...row,
        sort_order: i,
      }));
    } else if (childDef.table === 'reasoning_steps') {
      // Add step_order
      childRows = (childData as Record<string, unknown>[]).map((row, i) => ({
        [childDef.foreignKey]: parentId,
        ...row,
        step_order: i,
      }));
    } else {
      childRows = (childData as Record<string, unknown>[]).map((row) => ({
        [childDef.foreignKey]: parentId,
        ...row,
      }));
    }

    const { error: childError } = await supabase
      .from(childDef.table)
      .insert(childRows);

    if (childError) throw childError;
  }

  return inserted;
}

// ============================================================================
// Query helpers
// ============================================================================

export interface QueryFilters {
  document_id?: string;
  [key: string]: unknown;
}

/**
 * Query entities of a given type with optional filters.
 */
export async function queryEntities(
  entityType: EntityType,
  filters?: QueryFilters,
) {
  const table = TABLE_MAP[entityType];
  let query = supabase.from(table).select('*');

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Get a single entity by ID.
 */
export async function getEntity(entityType: EntityType, id: string) {
  const table = TABLE_MAP[entityType];
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// Cross-script deduplication
// ============================================================================

/**
 * Find an existing character or trick by name within a script or document.
 * When scriptId is provided, searches by name + script_id (cross-document dedup within script).
 * When scriptId is null/undefined, falls back to name + document_id (existing behavior).
 */
export async function findDuplicate(
  entityType: 'character' | 'trick',
  name: string,
  documentId: string,
  scriptId?: string | null,
) {
  const table = TABLE_MAP[entityType];

  let query = supabase
    .from(table)
    .select('*')
    .eq('name', name);

  if (scriptId) {
    // Cross-document dedup within the same script
    query = query.eq('script_id', scriptId);
  } else {
    // Fall back to per-document dedup
    query = query.eq('document_id', documentId);
  }

  const { data, error } = await query
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Upsert with deduplication for characters and tricks.
 * If a record with the same name exists (within script_id scope, or document_id fallback),
 * returns the existing one. Otherwise inserts a new record.
 */
export async function upsertEntityWithDedup(
  entityType: 'character' | 'trick',
  data: Record<string, unknown>,
  documentId: string,
  chunkId: string,
  scriptId?: string | null,
) {
  const name = data.name as string | undefined;
  if (name) {
    const existing = await findDuplicate(entityType, name, documentId, scriptId);
    if (existing) return existing;
  }
  return upsertEntity(entityType, data, documentId, chunkId, scriptId);
}
