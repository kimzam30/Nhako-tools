import { describe, expect, it } from 'vitest';
import { formatTime, parseTime } from './timecode';

describe('typed times', () => {
  it('reads seconds, m:ss and h:mm:ss', () => {
    expect(parseTime('83')).toBe(83);
    expect(parseTime('83.5')).toBe(83.5);
    expect(parseTime('83,5')).toBe(83.5);
    expect(parseTime('1:23')).toBe(83);
    expect(parseTime('1:02:03')).toBe(3723);
    expect(parseTime(' 0:05 ')).toBe(5);
  });

  it('treats empty as unset and nonsense as NaN', () => {
    expect(parseTime('')).toBeNull();
    expect(parseTime('abc')).toBeNaN();
    expect(parseTime('1:75')).toBeNaN();
    expect(parseTime('1:2:3:4')).toBeNaN();
    expect(parseTime('-5')).toBeNaN();
  });

  it('formats for summaries', () => {
    expect(formatTime(83)).toBe('1:23');
    expect(formatTime(83.5)).toBe('1:23.5');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(3723)).toBe('1:02:03');
  });
});
