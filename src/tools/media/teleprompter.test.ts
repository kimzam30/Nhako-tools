import { describe, it, expect } from 'vitest';
import {
  clampWpm, cleanRoomCode, clock, docxXmlToScript, followMatch, isRoomCode, normalizeWord,
  parseRemote, parseScript, parseState, pixelsPerSecond, readingSeconds, roomCode, scriptTitle, ROOM_ALPHABET,
} from './teleprompter';

describe('parseScript', () => {
  const s = parseScript(`# Intro
Hello **big** world. [SMILE]

Second [PAUSE] paragraph.
# Close
Bye [jeda]`);

  it('counts only the words read aloud', () => {
    expect(s.words).toEqual(['Hello', 'big', 'world.', 'Second', 'paragraph.', 'Bye']);
    expect(s.sections).toEqual(['Intro', 'Close']);
  });

  it('keeps blocks in order, with emphasis and cues', () => {
    expect(s.blocks.map((b) => b.kind)).toEqual(['heading', 'para', 'para', 'heading', 'para']);
    const first = s.blocks[1];
    expect(first?.kind === 'para' && first.items.map((i) => (i.kind === 'word' ? `${i.text}${i.em ? '*' : ''}` : `[${i.text}]`)))
      .toEqual(['Hello', 'big*', 'world.', '[SMILE]']);
  });

  it('stops only on pause cues, in either language and any case', () => {
    const cues = s.blocks.flatMap((b) => (b.kind === 'para' ? b.items.filter((i) => i.kind === 'cue') : []));
    expect(cues.map((c) => c.kind === 'cue' && [c.text, c.pause])).toEqual([['SMILE', false], ['PAUSE', true], ['jeda', true]]);
  });

  it('numbers words globally so the stage can find each one', () => {
    const idx = s.blocks.flatMap((b) => (b.kind === 'para' ? b.items.flatMap((i) => (i.kind === 'word' ? [i.index] : [])) : []));
    expect(idx).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('keeps punctuation with the word it follows, across emphasis', () => {
    const p = parseScript('Say **words per minute**, then go.');
    expect(p.words).toEqual(['Say', 'words', 'per', 'minute,', 'then', 'go.']);
    const items = p.blocks[0]?.kind === 'para' ? p.blocks[0].items : [];
    const comma = items.find((i) => i.kind === 'word' && i.text === ',');
    expect(comma).toMatchObject({ glue: true, index: 3, em: false });
    // A bold part of a word stays one word, so voice-follow can still match it.
    expect(parseScript('un**believ**able truly').words).toEqual(['unbelievable', 'truly']);
    // Spaces around emphasis still separate words.
    expect(parseScript('a **b** c').words).toEqual(['a', 'b', 'c']);
  });

  it('handles Windows line endings and an empty script', () => {
    expect(parseScript('a b\r\n\r\nc').blocks).toHaveLength(2);
    expect(parseScript('').words).toEqual([]);
  });
});

describe('timing', () => {
  it('reads 140 words in a minute at 140 wpm', () => {
    expect(readingSeconds(140, 140)).toBe(60);
    expect(clock(75)).toBe('1:15');
    expect(clock(3725)).toBe('1:02:05');
  });

  it('scrolls a line-height per word-group so the wpm holds at any text size', () => {
    // 600 words over 12 000 px is 20 px a word; 120 wpm is 2 words a second.
    expect(pixelsPerSecond(120, 12000, 600)).toBe(40);
    expect(pixelsPerSecond(120, 24000, 600)).toBe(80);
    expect(pixelsPerSecond(120, 1000, 0)).toBe(0);
  });

  it('keeps speed on its steps and in range', () => {
    expect(clampWpm(143)).toBe(140);
    expect(clampWpm(5)).toBe(60);
    expect(clampWpm(999)).toBe(260);
  });
});

describe('voice-follow', () => {
  const script = 'Good morning everyone and welcome to the annual general meeting of our association today we will look at the accounts'
    .split(' ').map(normalizeWord);

  it('finds the next word after what was just said', () => {
    expect(followMatch(script, ['welcome', 'to', 'the'], 0)).toBe(7);
  });

  it('ignores case, punctuation and accents', () => {
    expect(normalizeWord('Café,')).toBe('cafe');
    expect(followMatch(script, ['ANNUAL', 'general,'], 5)).toBe(9);
  });

  it('tolerates a misheard or skipped word', () => {
    // 0 good, 1 morning, ... 7 annual, 8 general, 9 meeting, 10 of
    expect(followMatch(script, ['annual', 'generous', 'meeting'], 5)).toBe(10);
    expect(followMatch(script, ['the', 'general', 'meeting'], 5)).toBe(10);
  });

  it('does not jump on one common word', () => {
    // "the" alone appears twice; one word is not enough when more were heard.
    expect(followMatch(script, ['blah', 'the'], 0)).toBeNull();
  });

  it('prefers the nearest match ahead of where you are', () => {
    const rep = 'thank you thank you very much thank you'.split(' ');
    // At word 6, the "thank you" at 6-7 is nearer than the one at 2-3 behind.
    expect(followMatch(rep, ['thank', 'you'], 6)).toBe(8);
    expect(followMatch(rep, ['thank', 'you'], 0)).toBe(2);
  });

  it('does not look too far ahead for a match', () => {
    const long = [...Array(200).fill('filler'), 'unique', 'phrase'];
    expect(followMatch(long, ['unique', 'phrase'], 0)).toBeNull();
    expect(followMatch(long, ['unique', 'phrase'], 150)).toBe(202);
  });
});

describe('remote messages', () => {
  it('lets through only known shapes and actions', () => {
    expect(parseRemote({ t: 'cmd', a: 'toggle' })).toEqual({ t: 'cmd', a: 'toggle' });
    expect(parseRemote({ t: 'hello', extra: 1 })).toEqual({ t: 'hello' });
    expect(parseRemote({ t: 'wpm', v: 1e9 })).toEqual({ t: 'wpm', v: 260 });
    expect(parseRemote({ t: 'cmd', a: 'deleteEverything' })).toBeNull();
    expect(parseRemote({ t: 'wpm', v: 'fast' })).toBeNull();
    expect(parseRemote('toggle')).toBeNull();
    expect(parseRemote(null)).toBeNull();
  });

  it('bounds the state a phone displays', () => {
    const s = parseState({ t: 'state', playing: true, wpm: 150, progress: 7, remaining: -3, section: 99, sections: ['A', 5, 'B'], recording: 'yes' });
    expect(s).toMatchObject({ playing: true, wpm: 150, progress: 1, remaining: 0, section: 1, sections: ['A', 'B'], recording: false });
    expect(parseState({ t: 'cmd' })).toBeNull();
  });
});

describe('room codes', () => {
  it('are 10 characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const c = roomCode();
      expect(isRoomCode(c)).toBe(true);
      expect(c).not.toMatch(/[01ILO]/);
    }
  });

  it('never use biased bytes', () => {
    // 248 and above would favour the first letters; they must be skipped.
    let calls = 0;
    const code = roomCode((n) => { calls++; return new Uint8Array(n).fill(calls === 1 ? 250 : 0); });
    expect(code).toBe(ROOM_ALPHABET[0]!.repeat(10));
    expect(calls).toBe(2);
  });

  it('tidy what people type', () => {
    expect(cleanRoomCode(' abc de-234 fg ')).toBe('ABCDE234FG');
    expect(isRoomCode('ABCDE234FG')).toBe(true);
    expect(isRoomCode('ABCDE1234F')).toBe(false);
  });
});

describe('importing', () => {
  it('reads Word paragraphs, headings, tabs and entities', () => {
    const xml = `<w:document><w:body>
      <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Opening</w:t></w:r></w:p>
      <w:p><w:r><w:t xml:space="preserve">Fish &amp; chips </w:t></w:r><w:r><w:t>today</w:t></w:r><w:r><w:tab/><w:t>now</w:t></w:r></w:p>
      <w:p/>
      <w:p><w:r><w:t>Bye</w:t></w:r></w:p>
    </w:body></w:document>`;
    expect(docxXmlToScript(xml)).toBe('# Opening\n\nFish & chips today now\n\nBye');
  });

  it('titles a script by its first heading or first words', () => {
    expect(scriptTitle('intro\n# Real title\nbody', 'x')).toBe('Real title');
    expect(scriptTitle('**One** two [PAUSE] three four five six seven', 'x')).toBe('One two three four five six');
    expect(scriptTitle('   ', 'Untitled')).toBe('Untitled');
  });
});
