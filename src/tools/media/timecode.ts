/**
 * Times typed by people: "83", "83.5", "1:23", "1:02:03", "1.23" never as minutes.
 * Returns seconds, null for an empty field, or NaN for something unreadable.
 */
export function parseTime(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (!s) return null;
  const parts = s.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return NaN;
  const nums = parts.map(Number);
  // Only the last part may carry a fraction or exceed 59 when it stands alone.
  if (nums.length > 1 && nums.slice(1).some((n) => n >= 60)) return NaN;
  return nums.reduce((total, n) => total * 60 + n, 0);
}

/** 83.5 -> "1:23.5", for summaries. */
export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const frac = Math.round((seconds - whole) * 10) / 10;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const sec = (whole % 60) + frac;
  const ss = (sec < 10 ? '0' : '') + (Number.isInteger(sec) ? String(sec) : sec.toFixed(1));
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
