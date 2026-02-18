import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { ChatMessage } from '../../../lib/services/chat';

// ============================================================================
// Mock Supabase
// ============================================================================

const mockSingle = vi.fn();
const mockOrder = vi.fn((): { data: ChatMessage[] | null; error: unknown } => ({ data: [], error: null }));
const mockEq = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ single: mockSingle, eq: mockEq }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      select: mockSelect,
    })),
  },
}));

// Import after mock setup
import {
  createSession,
  addMessage,
  getSessionMessages,
  getSessionHistory,
  messagesToBaseMessages,
} from '../../../lib/services/chat';
import { supabase } from '../../../lib/supabase';

// ============================================================================
// Helpers
// ============================================================================

function makeChatMessage(
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: 'msg-1',
    session_id: 'session-1',
    role: 'user',
    content: 'Hello',
    sources: null,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('chat service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // createSession
  // --------------------------------------------------------------------------

  describe('createSession', () => {
    it('creates a session and returns the id', async () => {
      const sessionData = { id: 'new-session-id', created_at: '2024-01-01T00:00:00Z' };
      mockSingle.mockResolvedValueOnce({ data: sessionData, error: null });

      const id = await createSession();

      expect(id).toBe('new-session-id');
      expect(supabase.from).toHaveBeenCalledWith('chat_sessions');
      expect(mockInsert).toHaveBeenCalledWith({});
    });

    it('throws on supabase error', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error', code: '500' },
      });

      await expect(createSession()).rejects.toEqual({
        message: 'DB error',
        code: '500',
      });
    });
  });

  // --------------------------------------------------------------------------
  // addMessage
  // --------------------------------------------------------------------------

  describe('addMessage', () => {
    it('stores a user message without sources', async () => {
      const msg = makeChatMessage();
      mockSingle.mockResolvedValueOnce({ data: msg, error: null });

      const result = await addMessage('session-1', 'user', 'Hello');

      expect(result).toEqual(msg);
      expect(supabase.from).toHaveBeenCalledWith('chat_messages');
      expect(mockInsert).toHaveBeenCalledWith({
        session_id: 'session-1',
        role: 'user',
        content: 'Hello',
        sources: null,
      });
    });

    it('stores an assistant message with sources', async () => {
      const sources = [{ document_name: 'test.pdf', page_start: 1 }];
      const msg = makeChatMessage({
        role: 'assistant',
        content: 'Answer',
        sources,
      });
      mockSingle.mockResolvedValueOnce({ data: msg, error: null });

      const result = await addMessage('session-1', 'assistant', 'Answer', sources);

      expect(result).toEqual(msg);
      expect(mockInsert).toHaveBeenCalledWith({
        session_id: 'session-1',
        role: 'assistant',
        content: 'Answer',
        sources,
      });
    });

    it('throws on supabase error', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(
        addMessage('session-1', 'user', 'Hello'),
      ).rejects.toEqual({ message: 'Insert failed' });
    });
  });

  // --------------------------------------------------------------------------
  // getSessionMessages
  // --------------------------------------------------------------------------

  describe('getSessionMessages', () => {
    it('returns messages ordered by created_at', async () => {
      const messages = [
        makeChatMessage({ id: 'msg-1', content: 'Hi', created_at: '2024-01-01T00:00:00Z' }),
        makeChatMessage({
          id: 'msg-2',
          role: 'assistant',
          content: 'Hello!',
          created_at: '2024-01-01T00:00:01Z',
        }),
      ];
      mockOrder.mockReturnValueOnce({ data: messages, error: null });

      const result = await getSessionMessages('session-1');

      expect(result).toEqual(messages);
      expect(supabase.from).toHaveBeenCalledWith('chat_messages');
      expect(mockEq).toHaveBeenCalledWith('session_id', 'session-1');
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('returns empty array when no messages', async () => {
      mockOrder.mockReturnValueOnce({ data: [], error: null });

      const result = await getSessionMessages('session-1');

      expect(result).toEqual([]);
    });

    it('returns empty array when data is null', async () => {
      mockOrder.mockReturnValueOnce({ data: null, error: null });

      const result = await getSessionMessages('session-1');

      expect(result).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // messagesToBaseMessages (pure function, no DB)
  // --------------------------------------------------------------------------

  describe('messagesToBaseMessages', () => {
    it('converts user messages to HumanMessage', () => {
      const messages = [makeChatMessage({ role: 'user', content: 'Question?' })];
      const result = messagesToBaseMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(HumanMessage);
      expect(result[0].content).toBe('Question?');
    });

    it('converts assistant messages to AIMessage', () => {
      const messages = [
        makeChatMessage({ role: 'assistant', content: 'Answer.' }),
      ];
      const result = messagesToBaseMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(AIMessage);
      expect(result[0].content).toBe('Answer.');
    });

    it('converts a multi-turn conversation correctly', () => {
      const messages = [
        makeChatMessage({ role: 'user', content: 'Q1' }),
        makeChatMessage({ role: 'assistant', content: 'A1' }),
        makeChatMessage({ role: 'user', content: 'Q2' }),
        makeChatMessage({ role: 'assistant', content: 'A2' }),
      ];
      const result = messagesToBaseMessages(messages);

      expect(result).toHaveLength(4);
      expect(result[0]).toBeInstanceOf(HumanMessage);
      expect(result[1]).toBeInstanceOf(AIMessage);
      expect(result[2]).toBeInstanceOf(HumanMessage);
      expect(result[3]).toBeInstanceOf(AIMessage);
      expect(result[0].content).toBe('Q1');
      expect(result[1].content).toBe('A1');
      expect(result[2].content).toBe('Q2');
      expect(result[3].content).toBe('A2');
    });

    it('returns empty array for empty input', () => {
      expect(messagesToBaseMessages([])).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // getSessionHistory
  // --------------------------------------------------------------------------

  describe('getSessionHistory', () => {
    it('loads messages and converts to BaseMessage format', async () => {
      const messages = [
        makeChatMessage({ role: 'user', content: 'What is a locked room trick?' }),
        makeChatMessage({ role: 'assistant', content: 'A locked room trick is...' }),
      ];
      mockOrder.mockReturnValueOnce({ data: messages, error: null });

      const result = await getSessionHistory('session-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(HumanMessage);
      expect(result[0].content).toBe('What is a locked room trick?');
      expect(result[1]).toBeInstanceOf(AIMessage);
      expect(result[1].content).toBe('A locked room trick is...');
    });

    it('returns empty array for session with no messages', async () => {
      mockOrder.mockReturnValueOnce({ data: [], error: null });

      const result = await getSessionHistory('session-1');

      expect(result).toEqual([]);
    });
  });
});
