import { describe, it, expect, vi } from 'vitest';
import { COFFEE_URL, MESSAGE_MAX, prepare, sendFeedback } from './community';
import { SUPABASE_HOST, SUPABASE_KEY } from './supabase';

describe('prepare', () => {
  const base = { kind: 'review' as const, message: '  Merge worked first time  ', locale: 'en' as const };

  it('trims the message and sends only the columns the table accepts', () => {
    const r = prepare({ ...base, tool: 'pdf/merge', rating: 5, contact: ' me@x.my ', role: 'student', page: '/pdf/merge' });
    expect(r).toEqual({ ok: true, row: { kind: 'review', message: 'Merge worked first time', locale: 'en', tool: 'pdf/merge', rating: 5, contact: 'me@x.my', role: 'student', page: '/pdf/merge' } });
  });

  it('leaves optional fields out entirely rather than sending blanks', () => {
    const r = prepare({ ...base, contact: '   ' });
    expect(r.ok && Object.keys(r.row).sort()).toEqual(['kind', 'locale', 'message']);
  });

  it('refuses what the database would refuse, before it is sent', () => {
    expect(prepare({ ...base, message: 'hi' })).toEqual({ ok: false, reason: 'short' });
    expect(prepare({ ...base, message: 'x'.repeat(MESSAGE_MAX + 1) })).toEqual({ ok: false, reason: 'long' });
    expect(prepare({ ...base, rating: 6 })).toEqual({ ok: false, reason: 'rating' });
    expect(prepare({ ...base, rating: 2.5 })).toEqual({ ok: false, reason: 'rating' });
    // @ts-expect-error: a kind the table's check constraint does not allow
    expect(prepare({ ...base, kind: 'spam' })).toEqual({ ok: false, reason: 'kind' });
  });

  it('never sends a status, so triage state cannot be forged', () => {
    const r = prepare({ ...base, ...({ status: 'done' } as object) });
    expect(r.ok && 'status' in r.row).toBe(false);
  });
});

describe('sendFeedback', () => {
  it('posts one row to the insert-only table with the publishable key', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 201 }));
    await sendFeedback({ kind: 'bug', message: 'Split hangs on a 300 page file', locale: 'en' }, fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://${SUPABASE_HOST}/rest/v1/tools_feedback`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).apikey).toBe(SUPABASE_KEY);
    expect((init.headers as Record<string, string>).Prefer).toBe('return=minimal');
    expect(JSON.parse(init.body as string)).toEqual({ kind: 'bug', message: 'Split hangs on a 300 page file', locale: 'en' });
  });

  it('throws with the status when the server refuses', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 400 }));
    await expect(sendFeedback({ kind: 'bug', message: 'hello there', locale: 'en' }, fetcher)).rejects.toThrow('feedback 400');
  });
});

describe('COFFEE_URL', () => {
  it('is an https Buy Me a Coffee page', () => {
    expect(COFFEE_URL).toMatch(/^https:\/\/buymeacoffee\.com\/[\w-]+$/);
  });
});
