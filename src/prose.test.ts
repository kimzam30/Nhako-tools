import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

/**
 * House style, enforced rather than remembered.
 *
 * The em dash is banned outright across the codebase, prose and comments
 * alike. A rule that only covers user-facing strings does not hold: comments
 * get quoted into docs, and a house style that is true of half the repository
 * is a style nobody can rely on.
 *
 * This is a test rather than a lint rule because it is about writing, not
 * about code, and because it has to reach .astro and .css files that the
 * TypeScript-aware linter does not parse.
 */

const SRC = fileURLToPath(new URL('.', import.meta.url));

/** Files whose content is authored, as opposed to generated or vendored. */
const EXTENSIONS = ['.ts', '.tsx', '.astro', '.css', '.md'];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...walk(path));
    } else if (EXTENSIONS.some((e) => entry.endsWith(e))) {
      out.push(path);
    }
  }
  return out;
}

const files = walk(SRC);

describe('house style', () => {
  it('finds the source files to check', () => {
    // A guard on the guard: a walk that silently returned nothing would make
    // every assertion below pass without reading a single line.
    expect(files.length).toBeGreaterThan(50);
  });

  it('uses no em dash anywhere, in prose or in comments', () => {
    const offenders: string[] = [];

    for (const path of files) {
      // This file necessarily contains the character it is looking for.
      if (path === fileURLToPath(import.meta.url)) continue;

      readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
        if (line.includes('—')) {
          offenders.push(`${relative(SRC, path)}:${i + 1}  ${line.trim().slice(0, 80)}`);
        }
      });
    }

    expect(offenders, `em dash found:\n${offenders.join('\n')}`).toEqual([]);
  });

  /**
   * Deliberately NOT banned, and listed here so the next person does not
   * "tidy" them away:
   *
   *   U+2212 MINUS SIGN, in the salary calculator and the teleprompter's
   *   speed control. It is an arithmetic operator, not punctuation, and a
   *   hyphen in its place renders a deduction as a stray dash.
   *
   *   U+2013 EN DASH, in a numeric range ("1-21") and inside the bullet
   *   character class in word-layout.ts, where it is a character being
   *   MATCHED in someone else's document rather than one being written.
   */
  it('keeps the minus sign in the deduction rows, which is not a dash', () => {
    const calculator = readFileSync(join(SRC, 'components/react/SalaryCalculator.tsx'), 'utf8');
    expect(calculator).toContain('−');
  });
});
