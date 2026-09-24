/**
 * The one Supabase project this site talks to (Kim's NhakoEcoDB), and the
 * publishable key, which is meant to be public.
 *
 * Two features use it, and only when someone uses them: the teleprompter's
 * phone remote (Realtime Broadcast, nothing stored) and the feedback form (one
 * insert-only table, `tools_feedback`). Row-level security lets the public
 * insert a feedback row and nothing else: no select, update or delete. The
 * migration is in supabase/migrations/. Files never go anywhere near this.
 */
export const SUPABASE_PROJECT = 'iznnnsiojfcbncrdqzyh';
export const SUPABASE_KEY = 'sb_publishable_teb6hKc0AaIeyqviEVG8NA_wdItnv4U';
export const SUPABASE_HOST = `${SUPABASE_PROJECT}.supabase.co`;
