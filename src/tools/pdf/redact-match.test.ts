import { describe, expect, it } from 'vitest';
import { EMAIL_PATTERN, IC_PATTERN, PHONE_PATTERN, findBoxes, termPatterns, type TextItem } from './redact-match';

const item = (str: string, x = 0, eol = false): TextItem => ({ str, x, y: 700, width: str.length * 6, height: 12, eol });

describe('redact matching', () => {
  it('finds a MyKad number split across two text items, boxing both parts', () => {
    const { boxes, matches } = findBoxes([item('IC: 880101-', 0), item('14-5678', 66)], [IC_PATTERN]);
    expect(matches).toBe(1);
    expect(boxes).toHaveLength(2);
    // The box on the first item starts after "IC: " (4 of 11 characters).
    expect(boxes[0]![0]).toBeCloseTo(24 - 4.2, 1);
  });

  it('matches IC numbers with or without dashes, but not longer digit runs', () => {
    const count = (s: string) => findBoxes([item(s)], [IC_PATTERN]).matches;
    expect(count('880101-14-5678')).toBe(1);
    expect(count('880101145678')).toBe(1);
    expect(count('1880101145678')).toBe(0);
  });

  it('matches Malaysian phone numbers and emails', () => {
    const n = (s: string, p: RegExp) => findBoxes([item(s)], [p]).matches;
    expect(n('Tel 012-345 6789', PHONE_PATTERN)).toBe(1);
    expect(n('Tel +6012-3456789', PHONE_PATTERN)).toBe(1);
    expect(n('Pejabat 03-1234 5678', PHONE_PATTERN)).toBe(1);
    expect(n('ali.bin.abu@example.com.my', EMAIL_PATTERN)).toBe(1);
  });

  it('finds typed terms case-insensitively, across a line break inside a phrase', () => {
    const pats = termPatterns('Ali bin Abu, gaji');
    expect(pats).toHaveLength(2);
    const { matches, boxes } = findBoxes([item('Nama: ALI BIN', 0, true), item('Abu. Gaji RM5,000')], pats);
    expect(matches).toBe(2);
    expect(boxes.length).toBe(3);
  });

  it('keeps an amount with a thousands comma as one term', () => {
    const pats = termPatterns('Ali bin Abu, 4,321.00; RM500');
    expect(pats).toHaveLength(3);
    expect(findBoxes([item('Gaji RM4,321.00')], pats).matches).toBe(1);
  });

  it('ignores one-letter terms, which would black out half a page', () => {
    expect(termPatterns('a, , b')).toHaveLength(0);
  });
});

describe('box placement with a measuring function', () => {
  it('places the box by measured width, not character count', () => {
    // "iiii" is narrow, "WWWW" wide: the match "WW" must start after the narrow run.
    const it: TextItem = { str: 'iiiiWW', x: 0, y: 0, width: 100, height: 10 };
    const measure = (s: string) => [...s].reduce((n, ch) => n + (ch === 'W' ? 10 : 2.5), 0);
    const { boxes } = findBoxes([it], termPatterns('WW'), measure);
    // Narrow run is 10 of 30 units, so the match starts a third of the way in.
    expect(boxes[0]![0]).toBeCloseTo(100 / 3 - 3.5, 1);
    expect(boxes[0]![2]).toBeCloseTo(100 + 3.5, 1);
  });
});
