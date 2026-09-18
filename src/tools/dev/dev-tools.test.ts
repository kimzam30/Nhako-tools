import { describe, it, expect } from 'vitest';
import { ToolError } from '../types';
import { run as json } from './json';
import { run as base64, encode, decode } from './base64';
import { run as jwt } from './jwt';
import { run as wordCount, count } from './word-count';
import { run as hash } from './hash';
import { run as uuid, generate } from './uuid';
import { run as diff } from './diff';
import { run as cssShadow } from './css-shadow';

describe('JSON formatter', () => {
  it('never changes a number, even beyond double precision', async () => {
    const r = await json('{"id": 12345678901234567890, "v": 1.10, "e": 1e5, "z": -0, "n": [42, 0.5]}', { indent: '0' });
    expect(r.output).toBe('{"id":12345678901234567890,"v":1.10,"e":1e5,"z":-0,"n":[42,0.5]}');
  });

  it('keeps preserved numbers attached to the right keys when sorting', async () => {
    const r = await json('{"b": 98765432109876543210, "a": 1.50}', { indent: '0', sortKeys: true });
    expect(r.output).toBe('{"a":1.50,"b":98765432109876543210}');
  });

  it('leaves number-like text inside strings alone', async () => {
    const r = await json('{"s": "12345678901234567890 and 1.10"}', { indent: '0' });
    expect(r.output).toBe('{"s":"12345678901234567890 and 1.10"}');
  });

  it('reports trailing content cleanly, with no mangled location', async () => {
    await expect(json('{"a":1} x', { indent: '2' })).rejects.toThrow(/^Unexpected content after the JSON value, found "x" at line 1, column 9\.$/);
  });

  it('locates errors itself, independent of the engine message (Safari gives no position)', async () => {
    const cases: [string, RegExp][] = [
      ['{\n  "a": 1\n  "b": 2\n}', /Expected ',' or '}' after the property value, found "\\"" at line 3, column 3/],
      ['{"a":1,}', /Trailing comma before '}'.* at line 1, column 8/],
      ['[1,2,]', /Trailing comma before ']'.* at line 1, column 6/],
      ["{'a':1}", /double quotes.* at line 1, column 2/],
      ['{"a" 1}', /Expected ':' .* at line 1, column 6/],
      ['{"a":"x\ny"}', /control character .* at line 1, column 8/],
      ['{"a":01}', /Expected ',' or '}' .* at line 1, column 7/],
      ['{"a":tru}', /Expected a value, found "t" at line 1, column 6/],
    ];
    for (const [doc, expected] of cases) {
      await expect(json(doc, { indent: '2' }), doc).rejects.toThrow(expected);
    }
  });

  it('agrees with JSON.parse about what is valid', async () => {
    const { locateJsonError } = await import('./json');
    for (const doc of ['{}', '[]', '0', '-1.5e+3', '"\\u00e9"', '{"a":[1,{"b":null}],"c":true}', ' [ 1 , 2 ] ']) {
      expect(() => JSON.parse(doc)).not.toThrow();
      expect(locateJsonError(doc), doc).toBeNull();
    }
  });

  it('pretty-prints with the requested indent', async () => {
    const r = await json('{"a":1}', { indent: '2', sortKeys: false });
    expect(r.output).toBe('{\n  "a": 1\n}');
  });

  it('minifies when indent is 0', async () => {
    const r = await json('{\n  "a": 1\n}', { indent: '0', sortKeys: false });
    expect(r.output).toBe('{"a":1}');
  });

  it('sorts keys deeply when asked', async () => {
    const r = await json('{"b":1,"a":{"d":2,"c":3}}', { indent: '0', sortKeys: true });
    expect(r.output).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('reports the line and column of a syntax error', async () => {
    // The old build surfaced the raw V8 message with a byte offset, which is
    // useless on a 400-line document.
    await expect(json('{\n  "a": 1\n  "b": 2\n}', { indent: '2', sortKeys: false }))
      .rejects.toThrow(/line 3/);
  });

  it('rejects trailing commas rather than silently accepting them', async () => {
    await expect(json('{"a":1,}', { indent: '2', sortKeys: false })).rejects.toBeInstanceOf(ToolError);
  });

  it('explains an unterminated document instead of echoing the source', async () => {
    await expect(json('[1,2,', { indent: '2', sortKeys: false })).rejects.toThrow(/incomplete/);
  });

  it('never echoes the whole input back inside the error message', async () => {
    // V8's "Unexpected token" message inlines the document, which is unreadable
    // for anything longer than a couple of lines.
    const doc = `{\n${'  "k": "v",\n'.repeat(30)}  "bad": }`;
    let error: unknown;
    try {
      await json(doc, { indent: '2', sortKeys: false });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ToolError);
    const { message } = error as Error;
    expect(message.length).toBeLessThan(120);
    expect(message).not.toContain('"k": "v"');
  });
});

describe('Base64', () => {
  it('round-trips plain ASCII', () => {
    expect(decode(encode('hello'))).toBe('hello');
  });

  it('round-trips multi-byte UTF-8 exactly', () => {
    // Emoji and non-Latin scripts are where naive btoa/atob implementations break.
    for (const s of ['héllo wörld', '日本語テキスト', '🎉 emoji 🚀', 'Ω≈ç√∫˜µ']) {
      expect(decode(encode(s))).toBe(s);
    }
  });

  it('produces URL-safe output with no padding when asked', () => {
    const out = encode('any carnal pleasure?', true);
    expect(out).not.toMatch(/[+/=]/);
    expect(decode(out)).toBe('any carnal pleasure?');
  });

  it('decodes URL-safe input without explicit configuration', () => {
    expect(decode(encode('sure.', true))).toBe('sure.');
  });

  it('gives an actionable error on malformed input', () => {
    expect(() => decode('!!!not base64!!!')).toThrow(ToolError);
  });

  it('reports binary payloads honestly instead of returning mojibake', () => {
    // btoa of raw bytes that are not valid UTF-8.
    expect(() => decode('/v8A')).toThrow(/not valid UTF-8/);
  });

  it('runs through the tool interface in both directions', async () => {
    const enc = await base64('hi', { mode: 'encode', urlSafe: false });
    expect(enc.output).toBe('aGk=');
    const dec = await base64('aGk=', { mode: 'decode', urlSafe: false });
    expect(dec.output).toBe('hi');
  });
});

describe('JWT decoder', () => {
  const b64url = (s: string) => Buffer.from(s).toString('base64url');

  it('rejects a payload that is JSON but not an object', async () => {
    for (const payload of ['null', '[]', '42']) {
      await expect(jwt(`${b64url('{"alg":"HS256"}')}.${b64url(payload)}.sig`, {}), payload).rejects.toThrow(/not to an object/);
    }
  });

  it('does not crash on a timestamp outside the valid date range', async () => {
    const r = await jwt(`${b64url('{"alg":"HS256"}')}.${b64url('{"exp":1e17}')}.sig`, {});
    expect(r.output).toContain('not a valid date');
  });

  // Signature is irrelevant here: this tool decodes, it does not verify.
  const make = (header: object, payload: object) =>
    `${encode(JSON.stringify(header), true)}.${encode(JSON.stringify(payload), true)}.sig`;

  it('decodes header and payload', async () => {
    const token = make({ alg: 'HS256', typ: 'JWT' }, { sub: '123', name: 'Ada' });
    const r = await jwt(token, {});
    expect(r.output).toContain('"sub": "123"');
    expect(r.output).toContain('"name": "Ada"');
    expect(r.stats?.find((s) => s.label === 'Algorithm')?.value).toBe('HS256');
  });

  it('handles base64url payloads needing padding', async () => {
    // Payload lengths that are not a multiple of 4 are the classic failure.
    for (const name of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
      const token = make({ alg: 'none' }, { name });
      await expect(jwt(token, {})).resolves.toBeTruthy();
    }
  });

  it('strips a Bearer prefix', async () => {
    const token = make({ alg: 'HS256' }, { sub: 'x' });
    await expect(jwt(`Bearer ${token}`, {})).resolves.toBeTruthy();
  });

  it('flags an expired token', async () => {
    const token = make({ alg: 'HS256' }, { exp: Math.floor(Date.now() / 1000) - 3600 });
    const r = await jwt(token, {});
    expect(r.stats?.find((s) => s.label === 'Status')?.value).toBe('EXPIRED');
  });

  it('flags a live token as valid', async () => {
    const token = make({ alg: 'HS256' }, { exp: Math.floor(Date.now() / 1000) + 3600 });
    const r = await jwt(token, {});
    expect(r.stats?.find((s) => s.label === 'Status')?.value).toBe('valid');
  });

  it('always states that the signature is unverified', async () => {
    const r = await jwt(make({ alg: 'HS256' }, { sub: 'x' }), {});
    expect(r.stats?.find((s) => s.label === 'Signature')?.value).toBe('not verified');
  });

  it('says how many parts it found when the shape is wrong', async () => {
    await expect(jwt('only.two', {})).rejects.toThrow(/2/);
  });
});

describe('word counter', () => {
  it('counts words, characters and lines', () => {
    const c = count('Hello world\nSecond line');
    expect(c.words).toBe(4);
    expect(c.characters).toBe(23);
    expect(c.lines).toBe(2);
  });

  it('returns zeroes for empty and whitespace-only input', () => {
    for (const s of ['', '   ', '\n\n  \t']) {
      expect(count(s).words).toBe(0);
      expect(count(s).readingMinutes).toBe(0);
    }
  });

  it('counts a sentence without terminal punctuation', () => {
    // The old implementation split on [.!?]+ and dropped the final fragment.
    expect(count('One. Two. Three').sentences).toBe(3);
  });

  it('does not count blank lines as paragraphs', () => {
    expect(count('Para one.\n\n\n\nPara two.').paragraphs).toBe(2);
  });

  it('counts consecutive spaces as a single separator', () => {
    expect(count('a     b').words).toBe(2);
  });

  it('exposes live stats through the tool interface', async () => {
    const r = await wordCount('one two three', {});
    expect(r.stats?.find((s) => s.label === 'Words')?.value).toBe('3');
  });
});

describe('hash generator', () => {
  it('matches the known SHA-256 of "abc"', async () => {
    const r = await hash('abc', { algo: 'SHA-256' });
    expect(r.output).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('matches the known SHA-1 of "abc"', async () => {
    const r = await hash('abc', { algo: 'SHA-1' });
    expect(r.output).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it('hashes the empty string rather than failing', async () => {
    const r = await hash('', { algo: 'SHA-256' });
    expect(r.output).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('hashes multi-byte input by its UTF-8 bytes', async () => {
    const r = await hash('日本', { algo: 'SHA-256' });
    expect(r.output).toHaveLength(64);
  });
});

describe('UUID generator', () => {
  it('generates the requested count', () => {
    expect(generate(25)).toHaveLength(25);
  });

  it('generates v4 UUIDs in canonical form', () => {
    for (const id of generate(20)) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it('produces no collisions across a large batch', () => {
    const ids = generate(1000);
    expect(new Set(ids).size).toBe(1000);
  });

  it('applies uppercase and brace formatting', () => {
    const [id] = generate(1, { uppercase: true, braces: true });
    expect(id).toMatch(/^\{[0-9A-F-]{36}\}$/);
  });

  it('clamps a nonsensical count instead of hanging', async () => {
    await expect(uuid('', { count: 999999 })).resolves.toHaveProperty('output');
    const r = await uuid('', { count: 999999 });
    expect(r.output.split('\n')).toHaveLength(1000);
  });

  it('survives a NaN count', async () => {
    const r = await uuid('', { count: Number.NaN });
    expect(r.output.split('\n')).toHaveLength(1);
  });
});

describe('text diff', () => {
  it('marks additions and removals', async () => {
    const r = await diff('a\nb\nc', { granularity: 'line', ignoreWhitespace: false }, 'a\nx\nc');
    expect(r.output).toContain('- b');
    expect(r.output).toContain('+ x');
  });

  it('says so plainly when inputs match', async () => {
    const r = await diff('same', { granularity: 'line', ignoreWhitespace: false }, 'same');
    expect(r.output).toMatch(/identical/);
  });

  it('can ignore whitespace', async () => {
    const r = await diff('a  b', { granularity: 'word', ignoreWhitespace: true }, 'a b');
    expect(r.output).toMatch(/identical/);
  });

  it('counts added and removed lines', async () => {
    const r = await diff('a\nb\n', { granularity: 'line', ignoreWhitespace: false }, 'a\nb\nc\nd\n');
    expect(r.stats?.find((s) => s.label === 'Added')?.value).toBe('+2 lines');
  });

  it('marks line diffs explicitly, so plain text is never coloured as one', async () => {
    const r = await diff('a', { granularity: 'line' }, 'b');
    expect(r.language).toBe('diff');
  });

  it('marks word changes inline rather than one fragment per line', async () => {
    const r = await diff('the quick brown fox', { granularity: 'word', ignoreWhitespace: false }, 'the slow brown dog');
    expect(r.output).not.toContain('\n');
    expect(r.output).toBe('the [-quick-]{+slow+} brown [-fox-]{+dog+}');
    expect(r.language).toBe('diff-inline');
    expect(r.segments?.filter((s) => s.kind !== 'same').map((s) => s.text)).toEqual(['quick', 'slow', 'fox', 'dog']);
  });

  it('counts words in word mode, not changed fragments', async () => {
    const r = await diff('one two three', { granularity: 'word', ignoreWhitespace: false }, 'one');
    expect(r.stats?.find((s) => s.label === 'Removed')?.value).toBe('-2 words');
  });

  it('honours ignore whitespace in character mode too', async () => {
    const r = await diff('a b', { granularity: 'char', ignoreWhitespace: true }, 'a  b');
    expect(r.output).toMatch(/identical/);
    const strict = await diff('a b', { granularity: 'char', ignoreWhitespace: false }, 'a  b');
    expect(strict.output).not.toMatch(/identical/);
  });
});

describe('CSS shadow generator', () => {
  it('emits a valid single-layer box-shadow', async () => {
    const r = await cssShadow('', { x: 0, y: 8, blur: 24, spread: -6, opacity: 18, color: '#131316', inset: false });
    expect(r.output).toBe('box-shadow: 0px 8px 24px -6px rgba(19, 19, 22, 0.18);');
  });

  it('supports inset', async () => {
    const r = await cssShadow('', { x: 0, y: 2, blur: 4, spread: 0, opacity: 50, color: '#000000', inset: true });
    expect(r.output).toContain('inset');
  });

  it('falls back to black on an invalid colour rather than emitting broken CSS', async () => {
    const r = await cssShadow('', { x: 0, y: 0, blur: 0, spread: 0, opacity: 10, color: 'nonsense', inset: false });
    expect(r.output).toContain('rgba(0, 0, 0, 0.1)');
  });

  it('provides a preview declaration for the live swatch', async () => {
    const r = await cssShadow('', { x: 0, y: 8, blur: 24, spread: -6, opacity: 18, color: '#131316', inset: false });
    expect(r.preview).toMatch(/^box-shadow: /);
  });
});
