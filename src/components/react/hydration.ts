/**
 * The live value of a server-rendered field, or `fallback` during SSR.
 *
 * Anything chosen or typed before an island hydrates stays on screen but is
 * invisible to state that starts from a default, so the page shows one thing
 * and computes another. Islands seed their state from the DOM instead.
 */
export function valueBeforeHydration(id: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const el = document.getElementById(id);
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement ? el.value : fallback;
}

/**
 * Option values as the server-rendered controls show them right now: what a
 * visitor chose before hydration, or the defaults. OptionsPanel gives each
 * control the id `opt-<key>`.
 */
export function optionsBeforeHydration(
  specs: readonly { key: string; kind: string }[],
  fallback: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  if (typeof document === 'undefined') return fallback;
  const out = { ...fallback };
  for (const spec of specs) {
    const el = document.getElementById(`opt-${spec.key}`);
    if (el instanceof HTMLSelectElement) out[spec.key] = el.value;
    else if (el instanceof HTMLInputElement) {
      if (spec.kind === 'toggle') out[spec.key] = el.checked;
      else if (spec.kind === 'number' || spec.kind === 'range') {
        const n = Number(el.value);
        if (el.value.trim() !== '' && Number.isFinite(n)) out[spec.key] = n;
      } else out[spec.key] = el.value;
    }
  }
  return out;
}

/**
 * Files already in a server-rendered file input when the island first
 * renders: picked before hydration, when the change event had no listener.
 * Read during render, never in an effect: Preact runs effects a frame later,
 * and by then a file picked after hydration is in the input too, and has
 * already been handled by its change event.
 */
export function filesBeforeHydration(id: string): File[] {
  if (typeof document === 'undefined') return [];
  const el = document.getElementById(id);
  return el instanceof HTMLInputElement && el.files ? Array.from(el.files) : [];
}
