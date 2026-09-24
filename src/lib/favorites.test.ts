import { describe, it, expect } from 'vitest';
import { FAVORITES_KEY, parseFavorites, readFavorites, toggleFavorite, writeFavorites } from './favorites';

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  };
};

describe('favourites', () => {
  it('survives garbage in storage', () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites('not json')).toEqual([]);
    expect(parseFavorites('{"a":1}')).toEqual([]);
    expect(parseFavorites('["pdf/merge", 3, "pdf/merge", "image/crop"]')).toEqual(['pdf/merge', 'image/crop']);
  });

  it('toggles on and off, keeping the order things were added in', () => {
    const store = memory();
    expect(toggleFavorite('pdf/merge', store)).toBe(true);
    expect(toggleFavorite('calc/cgpa', store)).toBe(true);
    expect(readFavorites(store)).toEqual(['pdf/merge', 'calc/cgpa']);
    expect(toggleFavorite('pdf/merge', store)).toBe(false);
    expect(readFavorites(store)).toEqual(['calc/cgpa']);
    expect(store.map.get(FAVORITES_KEY)).toBe('["calc/cgpa"]');
  });

  it('keeps working when storage throws', () => {
    const broken = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(readFavorites(broken)).toEqual([]);
    expect(() => writeFavorites(['pdf/merge'], broken)).not.toThrow();
    expect(toggleFavorite('pdf/merge', broken)).toBe(true);
  });
});
