// ============================================================================
// Store Results Node — Extraction Pipeline
//
// Persists extraction results into the relational database, establishing
// foreign-key links to document_chunks. Characters and tricks use
// deduplication (upsertEntityWithDedup); all other entity types use the
// standard upsertEntity path.
//
// Requirements: 2.3, 3.3, 4.3, 5.3, 6.4, 7.5, 8.3, 9.3, 10.4, 11.2, 11.3
// ============================================================================

import type { EntityType } from '../../../schemas';
import {
  upsertEntity,
  upsertEntityWithDedup,
} from '../../../services/extraction';

// ============================================================================
// Types
// ============================================================================

/** A single extraction result ready to be stored. */
export interface StoreInput {
  entityType: EntityType;
  data: Record<string, unknown>;
  documentId: string;
  chunkId: string;
  scriptId?: string | null;
}

/** The stored record returned from the database (includes generated id). */
export interface StoredRecord {
  entityType: EntityType;
  record: Record<string, unknown>;
}

// Entity types that require cross-script deduplication
const DEDUP_ENTITY_TYPES: ReadonlySet<EntityType> = new Set<EntityType>([
  'character',
  'trick',
]);

// ============================================================================
// Core function
// ============================================================================

/**
 * Store an array of extraction results into the database.
 *
 * - For `character` and `trick` entity types, uses `upsertEntityWithDedup`
 *   to avoid duplicates within the same document.
 * - For all other entity types, uses the standard `upsertEntity`.
 *
 * Returns an array of stored records (one per input).
 */
export async function storeExtractionResults(
  inputs: StoreInput[],
): Promise<StoredRecord[]> {
  const results: StoredRecord[] = [];

  for (const input of inputs) {
    const { entityType, data, documentId, chunkId, scriptId } = input;

    let record: Record<string, unknown>;

    if (DEDUP_ENTITY_TYPES.has(entityType)) {
      record = await upsertEntityWithDedup(
        entityType as 'character' | 'trick',
        data,
        documentId,
        chunkId,
        scriptId,
      );
    } else {
      record = await upsertEntity(entityType, data, documentId, chunkId, scriptId);
    }

    results.push({ entityType, record });
  }

  return results;
}
