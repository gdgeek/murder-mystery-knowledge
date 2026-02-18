import { supabase } from '../supabase';

// ============================================================================
// Document CRUD
// ============================================================================

export async function createDocument(filename: string, storagePath: string, scriptId?: string) {
  const row: Record<string, unknown> = { filename, storage_path: storagePath };
  if (scriptId) {
    row.script_id = scriptId;
  }

  const { data, error } = await supabase
    .from('documents')
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDocumentStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from('documents')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getDocument(id: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function listDocuments() {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
export async function listDocumentsByScriptId(scriptId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('script_id', scriptId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// ============================================================================
// Document Chunk CRUD
// ============================================================================

export interface ChunkInput {
  content: string;
  page_start: number;
  page_end: number;
  chunk_index: number;
}

export async function createChunks(documentId: string, chunks: ChunkInput[]) {
  const rows = chunks.map((c) => ({
    document_id: documentId,
    content: c.content,
    page_start: c.page_start,
    page_end: c.page_end,
    chunk_index: c.chunk_index,
  }));

  const { data, error } = await supabase
    .from('document_chunks')
    .insert(rows)
    .select();

  if (error) throw error;
  return data;
}

export async function getChunksByDocumentId(documentId: string) {
  const { data, error } = await supabase
    .from('document_chunks')
    .select('*')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true });

  if (error) throw error;
  return data;
}
