import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Supabase client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    await expect(() => import('@/lib/supabase')).rejects.toThrow(
      'Missing environment variable: NEXT_PUBLIC_SUPABASE_URL'
    );
  });

  it('throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    await expect(() => import('@/lib/supabase')).rejects.toThrow(
      'Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  });

  it('exports a supabase client when env vars are set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    const { supabase } = await import('@/lib/supabase');
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });
});
