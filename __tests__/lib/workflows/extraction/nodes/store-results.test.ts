import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before importing the module under test
// ---------------------------------------------------------------------------

const mockUpsertEntity = vi.fn();
const mockUpsertEntityWithDedup = vi.fn();

vi.mock('../../../../../lib/services/extraction', () => ({
  upsertEntity: (...args: unknown[]) => mockUpsertEntity(...args),
  upsertEntityWithDedup: (...args: unknown[]) => mockUpsertEntityWithDedup(...args),
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------

import {
  storeExtractionResults,
  type StoreInput,
} from '../../../../../lib/workflows/extraction/nodes/store-results';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOC_ID = 'doc-111';
const CHUNK_ID = 'chunk-222';

function makeInput(
  entityType: StoreInput['entityType'],
  data: Record<string, unknown> = {},
): StoreInput {
  return { entityType, data, documentId: DOC_ID, chunkId: CHUNK_ID };
}

function fakeRecord(id: string, extra: Record<string, unknown> = {}) {
  return { id, document_id: DOC_ID, chunk_id: CHUNK_ID, ...extra };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('storeExtractionResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertEntity.mockResolvedValue(fakeRecord('new-1'));
    mockUpsertEntityWithDedup.mockResolvedValue(fakeRecord('dedup-1'));
  });

  it('returns an empty array when given no inputs', async () => {
    const results = await storeExtractionResults([]);
    expect(results).toEqual([]);
    expect(mockUpsertEntity).not.toHaveBeenCalled();
    expect(mockUpsertEntityWithDedup).not.toHaveBeenCalled();
  });

  // ---- Deduplication path (character & trick) ----

  it('uses upsertEntityWithDedup for character entities', async () => {
    const data = { name: '张三', role: 'suspect', confidence: { name: 0.9 } };
    const results = await storeExtractionResults([makeInput('character', data)]);

    expect(mockUpsertEntityWithDedup).toHaveBeenCalledWith(
      'character',
      data,
      DOC_ID,
      CHUNK_ID,
      undefined,
    );
    expect(mockUpsertEntity).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].entityType).toBe('character');
  });

  it('uses upsertEntityWithDedup for trick entities', async () => {
    const data = { name: '密室诡计', type: 'locked_room' };
    const results = await storeExtractionResults([makeInput('trick', data)]);

    expect(mockUpsertEntityWithDedup).toHaveBeenCalledWith(
      'trick',
      data,
      DOC_ID,
      CHUNK_ID,
      undefined,
    );
    expect(mockUpsertEntity).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].entityType).toBe('trick');
  });

  // ---- Standard path (all other entity types) ----

  it('uses upsertEntity for story_background entities', async () => {
    const data = { era: '民国', location: '上海' };
    const results = await storeExtractionResults([makeInput('story_background', data)]);

    expect(mockUpsertEntity).toHaveBeenCalledWith(
      'story_background',
      data,
      DOC_ID,
      CHUNK_ID,
      undefined,
    );
    expect(mockUpsertEntityWithDedup).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].entityType).toBe('story_background');
  });

  it('uses upsertEntity for script_metadata entities', async () => {
    const data = { title: '迷雾庄园', author: '作者A' };
    const results = await storeExtractionResults([makeInput('script_metadata', data)]);

    expect(mockUpsertEntity).toHaveBeenCalledWith(
      'script_metadata',
      data,
      DOC_ID,
      CHUNK_ID,
      undefined,
    );
    expect(results[0].entityType).toBe('script_metadata');
  });

  it('uses upsertEntity for clue entities', async () => {
    const data = { name: '血迹', type: 'physical_evidence' };
    await storeExtractionResults([makeInput('clue', data)]);

    expect(mockUpsertEntity).toHaveBeenCalledWith('clue', data, DOC_ID, CHUNK_ID, undefined);
  });

  it('uses upsertEntity for all non-dedup entity types', async () => {
    const nonDedupTypes: StoreInput['entityType'][] = [
      'script_structure',
      'script_format',
      'player_script',
      'reasoning_chain',
      'misdirection',
      'game_mechanics',
      'narrative_technique',
      'emotional_design',
    ];

    for (const entityType of nonDedupTypes) {
      vi.clearAllMocks();
      mockUpsertEntity.mockResolvedValue(fakeRecord(`id-${entityType}`));

      await storeExtractionResults([makeInput(entityType, { foo: 'bar' })]);

      expect(mockUpsertEntity).toHaveBeenCalledOnce();
      expect(mockUpsertEntityWithDedup).not.toHaveBeenCalled();
    }
  });

  // ---- Multiple inputs ----

  it('processes multiple inputs sequentially and returns all results', async () => {
    mockUpsertEntityWithDedup
      .mockResolvedValueOnce(fakeRecord('char-1', { name: '张三' }))
      .mockResolvedValueOnce(fakeRecord('trick-1', { name: '密室' }));
    mockUpsertEntity.mockResolvedValueOnce(fakeRecord('bg-1', { era: '现代' }));

    const inputs: StoreInput[] = [
      makeInput('character', { name: '张三' }),
      makeInput('story_background', { era: '现代' }),
      makeInput('trick', { name: '密室' }),
    ];

    const results = await storeExtractionResults(inputs);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ entityType: 'character', record: fakeRecord('char-1', { name: '张三' }) });
    expect(results[1]).toEqual({ entityType: 'story_background', record: fakeRecord('bg-1', { era: '现代' }) });
    expect(results[2]).toEqual({ entityType: 'trick', record: fakeRecord('trick-1', { name: '密室' }) });
  });

  // ---- Error propagation ----

  it('propagates errors from upsertEntity', async () => {
    mockUpsertEntity.mockRejectedValueOnce(new Error('DB insert failed'));

    await expect(
      storeExtractionResults([makeInput('story_background', { era: '古代' })]),
    ).rejects.toThrow('DB insert failed');
  });

  it('propagates errors from upsertEntityWithDedup', async () => {
    mockUpsertEntityWithDedup.mockRejectedValueOnce(new Error('Dedup failed'));

    await expect(
      storeExtractionResults([makeInput('character', { name: '李四' })]),
    ).rejects.toThrow('Dedup failed');
  });

  // ---- Record passthrough ----

  it('returns the exact record from the service layer', async () => {
    const dbRecord = fakeRecord('abc-123', {
      name: '角色X',
      role: 'murderer',
      review_status: 'approved',
    });
    mockUpsertEntityWithDedup.mockResolvedValueOnce(dbRecord);

    const results = await storeExtractionResults([
      makeInput('character', { name: '角色X', role: 'murderer' }),
    ]);

    expect(results[0].record).toBe(dbRecord);
  });

  // ---- scriptId passthrough ----

  it('passes scriptId to upsertEntityWithDedup when provided', async () => {
    const data = { name: '张三', role: 'suspect' };
    const input: StoreInput = { entityType: 'character', data, documentId: DOC_ID, chunkId: CHUNK_ID, scriptId: 'script-999' };

    await storeExtractionResults([input]);

    expect(mockUpsertEntityWithDedup).toHaveBeenCalledWith(
      'character',
      data,
      DOC_ID,
      CHUNK_ID,
      'script-999',
    );
  });

  it('passes scriptId to upsertEntity when provided', async () => {
    const data = { era: '民国' };
    const input: StoreInput = { entityType: 'story_background', data, documentId: DOC_ID, chunkId: CHUNK_ID, scriptId: 'script-888' };

    await storeExtractionResults([input]);

    expect(mockUpsertEntity).toHaveBeenCalledWith(
      'story_background',
      data,
      DOC_ID,
      CHUNK_ID,
      'script-888',
    );
  });

  it('passes null scriptId through to service functions', async () => {
    const data = { name: '密室' };
    const input: StoreInput = { entityType: 'trick', data, documentId: DOC_ID, chunkId: CHUNK_ID, scriptId: null };

    await storeExtractionResults([input]);

    expect(mockUpsertEntityWithDedup).toHaveBeenCalledWith(
      'trick',
      data,
      DOC_ID,
      CHUNK_ID,
      null,
    );
  });
});
