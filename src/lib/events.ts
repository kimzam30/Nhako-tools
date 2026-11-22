/**
 * Anonymous task events: did a tool run, did it work, how long did it take.
 *
 * What is sent, and nothing else: the tool id, the event name, the page
 * language, phone or desktop, the number of files, a size class for their
 * total (never the size itself), the time taken, and whether a failure was a
 * message the user can act on or a crash. No file names, no file contents, no
 * error text, no cookies, no identifier, no IP address stored (the table has
 * no column for one). Browsers that send Do Not Track or Global Privacy
 * Control send nothing.
 *
 * Rows go into `tool_events`, an insert-only table in the same Supabase
 * project as the feedback form (migration in supabase/migrations/). Sending
 * never blocks or breaks a tool: every failure is swallowed.
 *
 * EVENTS_ENABLED stays false until that migration has been applied; until
 * then trackEvent is a no-op.
 */
import { SUPABASE_HOST, SUPABASE_KEY } from './supabase';

export const EVENTS_ENABLED = false;

export type ToolEvent = 'run_start' | 'run_ok' | 'run_error' | 'run_cancel' | 'file_added' | 'download';

export interface EventDetail {
  files?: number;
  /** Total input size in bytes; only its size class is sent. */
  bytes?: number;
  ms?: number;
  /** 'tool' = a ToolError the user can act on; 'crash' = anything else. */
  error?: 'tool' | 'crash';
}

export interface EventRow {
  tool: string;
  event: ToolEvent;
  locale: 'en' | 'ms';
  device: 'mobile' | 'desktop';
  files: number | null;
  size_class: string | null;
  ms: number | null;
  error: 'tool' | 'crash' | null;
}

/** Coarse size buckets, so a row never carries an exact file size. */
export function sizeClass(bytes: number | undefined): string | null {
  if (bytes === undefined || !(bytes >= 0)) return null;
  const mb = bytes / 1e6;
  if (mb < 1) return '<1MB';
  if (mb < 10) return '1-10MB';
  if (mb < 100) return '10-100MB';
  return '100MB+';
}

/** Build the row. Pure, so the privacy contract can be tested. */
export function buildRow(
  tool: string,
  event: ToolEvent,
  detail: EventDetail,
  env: { lang: string; coarse: boolean },
): EventRow {
  return {
    tool: tool.slice(0, 60),
    event,
    locale: env.lang.toLowerCase().startsWith('ms') ? 'ms' : 'en',
    device: env.coarse ? 'mobile' : 'desktop',
    files: detail.files === undefined ? null : Math.min(999, Math.max(0, Math.round(detail.files))),
    size_class: sizeClass(detail.bytes),
    ms: detail.ms === undefined ? null : Math.min(86_400_000, Math.max(0, Math.round(detail.ms))),
    error: detail.error ?? null,
  };
}

function optedOut(): boolean {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  return n.globalPrivacyControl === true || n.doNotTrack === '1';
}

/** Fire and forget. Never throws, never awaits. */
export function trackEvent(tool: string, event: ToolEvent, detail: EventDetail = {}): void {
  if (!EVENTS_ENABLED || typeof window === 'undefined' || typeof fetch === 'undefined') return;
  try {
    if (optedOut()) return;
    const row = buildRow(tool, event, detail, {
      lang: document.documentElement.lang || 'en',
      coarse: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    });
    void fetch(`https://${SUPABASE_HOST}/rest/v1/tool_events`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    }).catch(() => {});
  } catch {
    // Measurement must never cost the user anything.
  }
}
