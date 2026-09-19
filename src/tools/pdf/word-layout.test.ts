import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { toBlocks, toLines, familyOf, isBold, isItalic, type TextPiece } from './word-layout';
import { buildDocx, escapeXml } from '../../lib/docx';

/** A piece of body text; widths are roughly half the size per character. */
const piece = (str: string, x: number, y: number, extra: Partial<TextPiece> = {}): TextPiece => ({
  str, x, y, width: str.length * 5.5, size: 11, bold: false, italic: false, font: 'Calibri', ...extra,
});

/** A paragraph of `lines` lines, 14 pt apart, full width except the last. */
function para(words: string[], y: number, x = 72): TextPiece[] {
  return words.map((w, i) => piece(w, x, y + i * 14, { width: i === words.length - 1 ? 200 : 450 }));
}

describe('PDF to Word layout', () => {
  it('joins pieces on the same baseline into one line, in reading order', () => {
    const lines = toLines([piece('world', 130, 100.4), piece('Hello', 72, 100), piece('Next', 72, 114)]);
    expect(lines.map((l) => l.pieces.map((p) => p.str).join(' '))).toEqual(['Hello world', 'Next']);
  });

  it('rebuilds paragraphs from line spacing, and headings from size', () => {
    const blocks = toBlocks([
      piece('Annual Report', 72, 60, { size: 22, bold: true, width: 160 }),
      ...para(['The first paragraph runs across', 'two lines of text.'], 100),
      ...para(['A second paragraph starts after', 'a larger gap, as they do.'], 150),
      piece('Findings', 72, 200, { size: 15, bold: true, width: 70 }),
      ...para(['Short body text.'], 220),
    ], 595);
    expect(blocks.map((b) => [b.kind, b.level, b.runs.map((r) => r.text).join('')])).toEqual([
      ['heading', 1, 'Annual Report'],
      ['para', 0, 'The first paragraph runs across two lines of text.'],
      ['para', 0, 'A second paragraph starts after a larger gap, as they do.'],
      ['heading', 2, 'Findings'],
      ['para', 0, 'Short body text.'],
    ]);
  });

  it('keeps bold and italic runs inside a paragraph', () => {
    const [b] = toBlocks([
      piece('Plain ', 72, 100, { width: 33 }),
      piece('bold', 105, 100, { bold: true, width: 22 }),
      piece(' and ', 127, 100, { width: 27 }),
      piece('italic', 154, 100, { italic: true, width: 30 }),
    ], 595);
    expect(b!.runs.map((r) => [r.text, r.bold, r.italic])).toEqual([
      ['Plain ', false, false], ['bold', true, false], [' and ', false, false], ['italic', false, true],
    ]);
  });

  it('puts back spaces from gaps, and rejoins words hyphenated at a line end', () => {
    const [b] = toBlocks([
      piece('Selamat', 72, 100, { width: 40 }), piece('datang', 116, 100, { width: 35 }),
      piece('ke majlis pem-', 72, 114, { width: 450 }), piece('bukaan.', 72, 128, { width: 40 }),
    ], 595);
    expect(b!.runs.map((r) => r.text).join('')).toBe('Selamat datang ke majlis pembukaan.');
  });

  it('starts a new paragraph for each list item', () => {
    const blocks = toBlocks([
      piece('• First item', 90, 100, { width: 450 }),
      piece('• Second item', 90, 114, { width: 450 }),
      piece('1. Numbered', 90, 128, { width: 450 }),
    ], 595);
    expect(blocks.map((b) => b.runs[0]!.text)).toEqual(['• First item', '• Second item', '1. Numbered']);
  });

  it('centres a line set in the middle of the page', () => {
    const blocks = toBlocks([piece('Centred title line', 250, 80, { width: 95 }), ...para(['Body text that fills the whole column width.', 'End.'], 120)], 595);
    expect(blocks[0]!.align).toBe('center');
    expect(blocks[1]!.align).toBe('left');
  });

  it('names fonts the way a word processor does', () => {
    expect(familyOf('ABCDEF+TimesNewRomanPSMT')).toBe('Times New Roman');
    expect(familyOf('ArialMT')).toBe('Arial');
    expect(familyOf('BCDEEE+Calibri-Bold')).toBe('Calibri');
    expect(familyOf('Helvetica-Oblique')).toBe('Arial');
    expect(familyOf('OpenSans-SemiBold')).toBe('Open Sans');
    expect(isBold('Calibri-Bold') && isItalic('Arial-BoldItalicMT') && !isBold('Calibri')).toBe(true);
  });
});

describe('docx writer', () => {
  it('writes a valid package with headings, runs, page breaks and page size', async () => {
    const bytes = await buildDocx([
      { blocks: [
        { kind: 'heading', level: 1, align: 'center', indent: 0, runs: [{ text: 'Tajuk & <Title>', bold: true, italic: false, size: 20, font: 'Arial' }] },
        { kind: 'para', level: 0, align: 'left', indent: 36, runs: [{ text: 'Body ', bold: false, italic: false, size: 11, font: 'Calibri' }, { text: 'bold', bold: true, italic: false, size: 11, font: 'Calibri' }] },
      ] },
      { blocks: [{ kind: 'para', level: 0, align: 'left', indent: 0, runs: [{ text: 'Page two', bold: false, italic: true, size: 11, font: 'Calibri' }] }] },
    ], { width: 595, height: 842, margin: { top: 72, right: 72, bottom: 72, left: 72 } }, { size: 11, font: 'Calibri' });

    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files).sort()).toEqual(expect.arrayContaining(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels']));
    const doc = await zip.file('word/document.xml')!.async('string');
    // Well-formedness is checked in the browser (e2e/phase4.spec.ts), which has an XML parser.
    expect(doc).toContain('<w:pStyle w:val="Heading1"/>');
    expect(doc).toContain('Tajuk &amp; &lt;Title&gt;');
    expect(doc).toContain('<w:jc w:val="center"/>');
    expect(doc).toContain('<w:ind w:left="720"/>');
    expect(doc).toContain('<w:b/></w:rPr><w:t xml:space="preserve">bold</w:t>');
    expect(doc).toContain('<w:pageBreakBefore/>');
    expect(doc).toContain('<w:pgSz w:w="11900" w:h="16840"/>');
  });

  it('drops characters XML cannot hold', () => {
    expect(escapeXml('a\u0001b\u000Bc\td')).toBe('abc\td');
  });
});
