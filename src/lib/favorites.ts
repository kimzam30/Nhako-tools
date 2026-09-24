/**
 * Favourite tools, kept in this browser only.
 *
 * There are no accounts, so there is nowhere else to keep them, and a list of
 * tool ids is not worth sending anywhere. Order is the order they were added,
 * which is the order the favourites page shows them in.
 *
 * Every read and write is wrapped: storage throws in some private windows and
 * when site data is blocked, and the site must still work there, just without
 * remembering.
 */

export const FAVORITES_KEY = 'nhako:favourites';
/** Fired on window whenever the list changes, in this tab or another one. */
export const FAVORITES_EVENT = 'nhako:favourites';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const storage = (): Store | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

/** Parse whatever is stored, keeping only strings and dropping repeats. */
export function parseFavorites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((v): v is string => typeof v === 'string'))];
  } catch {
    return [];
  }
}

export function readFavorites(store: Store | undefined = storage()): string[] {
  try {
    return parseFavorites(store?.getItem(FAVORITES_KEY) ?? null);
  } catch {
    return [];
  }
}

export function writeFavorites(ids: string[], store: Store | undefined = storage()): void {
  try {
    store?.setItem(FAVORITES_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // Full or blocked. The in-page state still changes for this visit.
  }
  globalThis.dispatchEvent?.(new CustomEvent(FAVORITES_EVENT));
}

/** Add the id if absent, remove it if present. Returns whether it is now a favourite. */
export function toggleFavorite(id: string, store: Store | undefined = storage()): boolean {
  const list = readFavorites(store);
  const on = !list.includes(id);
  writeFavorites(on ? [...list, id] : list.filter((x) => x !== id), store);
  return on;
}
