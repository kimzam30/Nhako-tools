/**
 * Refuse, up front and in words, a job that would crash the tab.
 *
 * A wasm engine that runs out of memory takes the whole tab down, and on iOS
 * Safari the page simply reloads with no message: the person loses their
 * place and learns nothing. The browser does not say how much memory a page
 * may use, but Chromium reports the device's RAM (navigator.deviceMemory,
 * rounded, capped at 8 GB). Where it is missing (Safari, Firefox) nothing is
 * refused: a wrong refusal is worse than the crash it tries to prevent.
 */
import { ToolError } from '../tools/types';
import type { Say } from '../tools/say';
import { bytes as formatBytes } from './format';

const GB = 1024 ** 3;

/** Device RAM in bytes, or null when the browser does not say. */
export function deviceMemory(nav: { deviceMemory?: number } | undefined = globalThis.navigator as never): number | null {
  const gb = nav?.deviceMemory;
  return typeof gb === 'number' && gb > 0 ? gb * GB : null;
}

/**
 * How much a single tab can reasonably work with: a quarter of the device's
 * RAM, never more than 2 GB (the 32-bit wasm heap ceiling ffmpeg.wasm uses).
 */
export function workingBudget(ram: number | null): number | null {
  return ram === null ? null : Math.min(ram / 4, 2 * GB);
}

/**
 * Throw a ToolError when `need` bytes will not fit.
 * `need` is the job's peak estimate (input, output and engine copies).
 */
export function assertFits(need: number, what: string, say: Say, ram = deviceMemory()) {
  const budget = workingBudget(ram);
  if (budget === null || need <= budget) return;
  throw new ToolError(say(
    `${what} is too big to process on this device (it would need about ${formatBytes(need)} of memory, and this browser can safely use about ${formatBytes(budget)}). Try a shorter or smaller file, or use a computer.`,
    `${what} terlalu besar untuk diproses pada peranti ini (ia memerlukan kira-kira ${formatBytes(need)} memori, dan pelayar ini hanya boleh guna kira-kira ${formatBytes(budget)} dengan selamat). Cuba fail yang lebih pendek atau kecil, atau guna komputer.`,
  ));
}

/** LibreOffice unpacks to about 250 MB and needs about 1 GB to run. */
export function assertCanRunOffice(say: Say, ram = deviceMemory()) {
  if (ram === null || ram >= 4 * GB) return;
  throw new ToolError(say(
    'Office to PDF needs a device with at least 4 GB of memory, and this one reports less. Use a computer for this one; nothing was downloaded.',
    'Office ke PDF memerlukan peranti dengan sekurang-kurangnya 4 GB memori, dan peranti ini melaporkan kurang. Guna komputer untuk ini; tiada apa yang dimuat turun.',
  ));
}
