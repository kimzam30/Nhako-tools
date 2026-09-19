/**
 * A minimal Word (.docx) writer: the handful of Office Open XML parts every
 * word processor needs, zipped. Paragraphs, two heading levels, bold,
 * italic, size, font, alignment, indents and page breaks. Nothing else, and
 * no dependency beyond the zip library the site already uses.
 */
import type { Block } from '../tools/pdf/word-layout';

export interface DocxPage { blocks: Block[] }

export interface DocxOptions {
  /** Page size and margins in points. */
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  title?: string;
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

export function escapeXml(s: string): string {
  // Also drop characters XML 1.0 forbids (control codes some PDFs contain).
  return s
    // eslint-disable-next-line no-control-regex -- matching control codes is the point
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const twips = (pt: number) => Math.round(pt * 20);
const halfPoints = (pt: number) => Math.max(2, Math.round(pt * 2));

function paragraph(b: Block, pageBreakBefore: boolean, bodySize: number): string {
  const pPr: string[] = [];
  if (b.kind === 'heading') pPr.push(`<w:pStyle w:val="Heading${b.level}"/>`);
  if (pageBreakBefore) pPr.push('<w:pageBreakBefore/>');
  if (b.align === 'center') pPr.push('<w:jc w:val="center"/>');
  if (b.indent > 4) pPr.push(`<w:ind w:left="${twips(b.indent)}"/>`);
  const runs = b.runs.map((r) => {
    const rPr: string[] = [`<w:rFonts w:ascii="${escapeXml(r.font)}" w:hAnsi="${escapeXml(r.font)}" w:cs="${escapeXml(r.font)}"/>`];
    if (r.bold) rPr.push('<w:b/>');
    if (r.italic) rPr.push('<w:i/>');
    // Headings take their size from the run; body text only where it differs.
    if (b.kind === 'heading' || Math.abs(r.size - bodySize) >= 0.5) rPr.push(`<w:sz w:val="${halfPoints(r.size)}"/><w:szCs w:val="${halfPoints(r.size)}"/>`);
    return `<w:r><w:rPr>${rPr.join('')}</w:rPr><w:t xml:space="preserve">${escapeXml(r.text)}</w:t></w:r>`;
  }).join('');
  return `<w:p>${pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''}${runs}</w:p>`;
}

export function documentXml(pages: DocxPage[], opts: DocxOptions, bodySize: number): string {
  const body: string[] = [];
  pages.forEach((page, i) => {
    if (page.blocks.length === 0) {
      body.push(`<w:p>${i > 0 ? '<w:pPr><w:pageBreakBefore/></w:pPr>' : ''}</w:p>`);
      return;
    }
    page.blocks.forEach((b, j) => body.push(paragraph(b, i > 0 && j === 0, bodySize)));
  });
  const m = opts.margin;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="${twips(opts.width)}" w:h="${twips(opts.height)}"${opts.width > opts.height ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${twips(m.top)}" w:right="${twips(m.right)}" w:bottom="${twips(m.bottom)}" w:left="${twips(m.left)}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

function stylesXml(bodySize: number, bodyFont: string): string {
  const f = escapeXml(bodyFont);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/><w:sz w:val="${halfPoints(bodySize)}"/><w:szCs w:val="${halfPoints(bodySize)}"/><w:lang w:val="en-MY"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
</w:styles>`;
}

/** The .docx file, as bytes. */
export async function buildDocx(pages: DocxPage[], opts: DocxOptions, body: { size: number; font: string }): Promise<Uint8Array> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(opts.title ?? '')}</dc:title><dc:creator>Nhako Tools</dc:creator></cp:coreProperties>`);
  zip.file('word/styles.xml', stylesXml(body.size, body.font));
  zip.file('word/document.xml', documentXml(pages, opts, body.size));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
