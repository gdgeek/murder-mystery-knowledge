// ============================================================================
// Chat Session & Message Service
//
// Manages chat sessions, message persistence, and history loading.
// Converts stored messages to LangChain BaseMessage format for LLM context.
//
// Requirements: 13.4
// ============================================================================

import { supabase } from '../supabase';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: Record<string, unknown>[] | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  created_at: string;
}

// ============================================================================
// Session management
// ============================================================================

/**
 * Create a new chat session. Returns the session ID.
 */
export async function createSession(): Promise<string> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({})
    .select()
    .single();

  if (error) throw error;
  return (data as ChatSession).id;
}

// ============================================================================
// Message management
// ============================================================================

/**
 * Store a message in a chat session.
 */
export async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  sources?: Record<string, unknown>[] | null,
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      role,
      content,
      sources: sources ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ChatMessage;
}

/**
 * Load all messages for a session, ordered by created_at ascending.
 */
export async function getSessionMessages(
  sessionId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

// ============================================================================
// LangChain integration
// ============================================================================

/**
 * Load session messages and convert to LangChain BaseMessage format
 * for passing as chat history to the LLM.
 *
 * - role "user" → HumanMessage
 * - role "assistant" → AIMessage
 */
export async function getSessionHistory(
  sessionId: string,
): Promise<BaseMessage[]> {
  const messages = await getSessionMessages(sessionId);
  return messagesToBaseMessages(messages);
}

/**
 * Convert ChatMessage array to LangChain BaseMessage array.
 * Exported for testability without DB dependency.
 */
export function messagesToBaseMessages(messages: ChatMessage[]): BaseMessage[] {
  return messages.map((msg) =>
    msg.role === 'user'
      ? new HumanMessage(msg.content)
      : new AIMessage(msg.content),
  );
}
