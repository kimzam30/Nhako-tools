import { SUPABASE_HOST, SUPABASE_KEY } from './supabase';

/**
 * Everything the community features need: where a donation goes, and how a
 * piece of feedback is sent.
 *
 * COFFEE_URL is the one line to change if the Buy Me a Coffee page lives at a
 * different handle. Every coffee button on the site reads it from here.
 */
export const COFFEE_URL = 'https://buymeacoffee.com/nhakotools';

export const FEEDBACK_KINDS = ['suggestion', 'review', 'complaint', 'bug', 'tool-request', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const ROLES = ['student', 'teacher', 'work', 'other'] as const;
export type Role = (typeof ROLES)[number];

export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 4000;

export interface Feedback {
  kind: FeedbackKind;
  message: string;
  tool?: string;
  rating?: number;
  contact?: string;
  role?: Role;
  locale: 'en' | 'ms';
  page?: string;
}

/** Shape a form's values into exactly what the table accepts, or say why not. */
export function prepare(input: Feedback): { ok: true; row: Record<string, unknown> } | { ok: false; reason: 'kind' | 'short' | 'long' | 'rating' } {
  if (!FEEDBACK_KINDS.includes(input.kind)) return { ok: false, reason: 'kind' };
  const message = input.message.trim();
  if (message.length < MESSAGE_MIN) return { ok: false, reason: 'short' };
  if (message.length > MESSAGE_MAX) return { ok: false, reason: 'long' };
  if (input.rating !== undefined && !(Number.isInteger(input.rating) && input.rating >= 1 && input.rating <= 5)) {
    return { ok: false, reason: 'rating' };
  }
  const row: Record<string, unknown> = { kind: input.kind, message, locale: input.locale };
  if (input.tool) row.tool = input.tool.slice(0, 60);
  if (input.rating !== undefined) row.rating = input.rating;
  const contact = input.contact?.trim();
  if (contact) row.contact = contact.slice(0, 200);
  if (input.role && ROLES.includes(input.role)) row.role = input.role;
  if (input.page) row.page = input.page.slice(0, 200);
  return { ok: true, row };
}

/** Send one row. Resolves on success, throws with a status code otherwise. */
export async function sendFeedback(row: Record<string, unknown>, fetcher: typeof fetch = fetch): Promise<void> {
  const res = await fetcher(`https://${SUPABASE_HOST}/rest/v1/tools_feedback`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`feedback ${res.status}`);
}
