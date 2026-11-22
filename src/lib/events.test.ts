import { describe, expect, it } from 'vitest';
import { buildRow, EVENTS_ENABLED, sizeClass, trackEvent } from './events';

describe('task events', () => {
  it('sends only the documented columns, with no file details', () => {
    const row = buildRow('pdf/compress', 'run_ok', { files: 2, bytes: 3_400_000, ms: 1234.6 }, { lang: 'ms-MY', coarse: true });
    expect(Object.keys(row).sort()).toEqual(['device', 'error', 'files', 'locale', 'ms', 'size_class', 'tool', 'event'].sort());
    expect(row).toEqual({
      tool: 'pdf/compress', event: 'run_ok', locale: 'ms', device: 'mobile',
      files: 2, size_class: '1-10MB', ms: 1235, error: null,
    });
  });

  it('buckets sizes instead of sending them', () => {
    expect(sizeClass(undefined)).toBeNull();
    expect(sizeClass(999_999)).toBe('<1MB');
    expect(sizeClass(1_000_000)).toBe('1-10MB');
    expect(sizeClass(50_000_000)).toBe('10-100MB');
    expect(sizeClass(2e9)).toBe('100MB+');
  });

  it('clamps values to what the table accepts', () => {
    const row = buildRow('x'.repeat(100), 'run_error', { files: 5000, ms: -3, error: 'tool' }, { lang: 'en', coarse: false });
    expect(row.tool).toHaveLength(60);
    expect(row.files).toBe(999);
    expect(row.ms).toBe(0);
    expect(row.locale).toBe('en');
    expect(row.device).toBe('desktop');
    expect(row.error).toBe('tool');
  });

  it('stays off until the table exists, and never throws', () => {
    expect(EVENTS_ENABLED).toBe(false);
    expect(() => trackEvent('pdf/merge', 'run_start')).not.toThrow();
  });
});
