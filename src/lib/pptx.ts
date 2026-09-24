/**
 * A minimal PowerPoint (.pptx) writer: the Office Open XML parts every
 * presentation program needs, zipped. One master, one blank layout, one
 * theme; each slide is a picture plus text boxes. No dependency beyond the
 * zip library the site already uses, the same way lib/docx.ts writes Word.
 *
 * Units: positions arrive in points and are written in EMU (12,700 per
 * point). Font sizes are written in hundredths of a point.
 */
import { escapeXml } from './docx';

export interface PptxRun { text: string; size: number; bold: boolean; italic: boolean; font: string; color: string }
export interface PptxParagraph { runs: PptxRun[] }
export interface PptxTextBox {
  x: number; y: number; width: number; height: number;
  paragraphs: PptxParagraph[];
  /** Distance between baselines, in points, when there is more than one line. */
  lineSpacing?: number;
  /** Degrees clockwise, turned about the box's centre. */
  rotation?: number;
}
export interface PptxSlide {
  /** JPEG or PNG bytes for a full-bleed picture, or none. */
  image?: { bytes: Uint8Array; type: 'jpeg' | 'png' };
  boxes: PptxTextBox[];
  /** Where the picture sits, in points. Defaults to the whole slide. */
  pictureFit?: { x: number; y: number; width: number; height: number };
}
export interface PptxOptions { width: number; height: number; title?: string }

const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS = `xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"`;
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

export const emu = (pt: number) => Math.round(pt * 12700);
/** PowerPoint accepts slides from 1 to 56 inches on each side. */
const clampSide = (pt: number) => Math.min(4032, Math.max(72, pt));

function run(r: PptxRun): string {
  const size = Math.min(400000, Math.max(100, Math.round(r.size * 100)));
  const color = /^[0-9A-F]{6}$/i.test(r.color) ? r.color.toUpperCase() : '000000';
  const font = escapeXml(r.font || 'Arial');
  return `<a:r><a:rPr lang="en-US" sz="${size}" b="${r.bold ? 1 : 0}" i="${r.italic ? 1 : 0}" dirty="0">` +
    `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${font}"/><a:cs typeface="${font}"/></a:rPr>` +
    `<a:t>${escapeXml(r.text)}</a:t></a:r>`;
}

function textBox(b: PptxTextBox, id: number): string {
  const spacing = b.lineSpacing && b.paragraphs.length > 1
    ? `<a:lnSpc><a:spcPts val="${Math.min(158400, Math.max(0, Math.round(b.lineSpacing * 100)))}"/></a:lnSpc>`
    : '';
  const paras = b.paragraphs.map((p) =>
    `<a:p><a:pPr>${spacing}</a:pPr>${p.runs.map(run).join('')}</a:p>`).join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm${b.rotation ? ` rot="${Math.round((((b.rotation % 360) + 360) % 360) * 60000)}"` : ''}><a:off x="${emu(b.x)}" y="${emu(b.y)}"/><a:ext cx="${Math.max(1, emu(b.width))}" cy="${Math.max(1, emu(b.height))}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
    '<p:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>' +
    `${paras}</p:txBody></p:sp>`;
}

function picture(id: number, x: number, y: number, cx: number, cy: number): string {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Page picture"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    '<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

const GROUP_HEAD = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

function slideXml(s: PptxSlide, cx: number, cy: number): string {
  let id = 2;
  const shapes: string[] = [];
  if (s.image) {
    const f = s.pictureFit;
    shapes.push(f ? picture(id++, emu(f.x), emu(f.y), emu(f.width), emu(f.height)) : picture(id++, 0, 0, cx, cy));
  }
  for (const b of s.boxes) shapes.push(textBox(b, id++));
  return `${XML}<p:sld ${NS}><p:cSld><p:spTree>${GROUP_HEAD}${shapes.join('')}</p:spTree></p:cSld>` +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
}

const LEVEL = '<a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr>';

const MASTER = `${XML}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${GROUP_HEAD}</p:spTree></p:cSld>` +
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
  '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
  `<p:txStyles><p:titleStyle>${LEVEL}</p:titleStyle><p:bodyStyle>${LEVEL}</p:bodyStyle><p:otherStyle>${LEVEL}</p:otherStyle></p:txStyles></p:sldMaster>`;

const LAYOUT = `${XML}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${GROUP_HEAD}</p:spTree></p:cSld>` +
  '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';

const solid = (v: string) => `<a:solidFill><a:schemeClr val="${v}"/></a:solidFill>`;
const THEME = `${XML}<a:theme xmlns:a="${NS_A}" name="Nhako"><a:themeElements>` +
  '<a:clrScheme name="Nhako"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>' +
  '<a:dk2><a:srgbClr val="1F1F24"/></a:dk2><a:lt2><a:srgbClr val="F4F4F6"/></a:lt2>' +
  '<a:accent1><a:srgbClr val="C7009B"/></a:accent1><a:accent2><a:srgbClr val="016ED6"/></a:accent2>' +
  '<a:accent3><a:srgbClr val="258101"/></a:accent3><a:accent4><a:srgbClr val="986600"/></a:accent4>' +
  '<a:accent5><a:srgbClr val="087D7E"/></a:accent5><a:accent6><a:srgbClr val="E10225"/></a:accent6>' +
  '<a:hlink><a:srgbClr val="016ED6"/></a:hlink><a:folHlink><a:srgbClr val="7A3FB0"/></a:folHlink></a:clrScheme>' +
  '<a:fontScheme name="Nhako"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
  '<a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
  '<a:fmtScheme name="Nhako"><a:fillStyleLst>' + solid('phClr') + solid('phClr') + solid('phClr') + '</a:fillStyleLst>' +
  '<a:lnStyleLst>' + [6350, 12700, 19050].map((w) => `<a:ln w="${w}">${solid('phClr')}</a:ln>`).join('') + '</a:lnStyleLst>' +
  '<a:effectStyleLst>' + '<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3) + '</a:effectStyleLst>' +
  '<a:bgFillStyleLst>' + solid('phClr') + solid('phClr') + solid('phClr') + '</a:bgFillStyleLst>' +
  '</a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>';

const rels = (items: [string, string, string][]) =>
  `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type.startsWith('http') ? type : `${REL}/${type}`}" Target="${target}"/>`).join('') +
  '</Relationships>';

const CT = 'application/vnd.openxmlformats-officedocument';

export async function buildPptx(slides: PptxSlide[], opts: PptxOptions): Promise<Uint8Array> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const cx = emu(clampSide(opts.width));
  const cy = emu(clampSide(opts.height));
  const n = slides.length;

  const overrides = [
    ['/ppt/presentation.xml', `${CT}.presentationml.presentation.main+xml`],
    ['/ppt/slideMasters/slideMaster1.xml', `${CT}.presentationml.slideMaster+xml`],
    ['/ppt/slideLayouts/slideLayout1.xml', `${CT}.presentationml.slideLayout+xml`],
    ['/ppt/theme/theme1.xml', `${CT}.theme+xml`],
    ['/ppt/presProps.xml', `${CT}.presentationml.presProps+xml`],
    ['/ppt/viewProps.xml', `${CT}.presentationml.viewProps+xml`],
    ['/ppt/tableStyles.xml', `${CT}.presentationml.tableStyles+xml`],
    ['/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml'],
    ['/docProps/app.xml', `${CT}.extended-properties+xml`],
    ...slides.map((_, i) => [`/ppt/slides/slide${i + 1}.xml`, `${CT}.presentationml.slide+xml`]),
  ];
  zip.file('[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/>' +
    overrides.map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join('') + '</Types>');

  zip.file('_rels/.rels', rels([
    ['rId1', 'officeDocument', 'ppt/presentation.xml'],
    ['rId2', 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml'],
    ['rId3', 'extended-properties', 'docProps/app.xml'],
  ]));

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  zip.file('docProps/core.xml', `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${escapeXml(opts.title ?? 'Presentation')}</dc:title><dc:creator>Nhako Tools</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
  zip.file('docProps/app.xml', `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">` +
    `<Application>Nhako Tools</Application><Slides>${n}</Slides></Properties>`);

  zip.file('ppt/presentation.xml', `${XML}<p:presentation ${NS} saveSubsetFonts="1">` +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    `<p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}</p:sldIdLst>` +
    `<p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  zip.file('ppt/_rels/presentation.xml.rels', rels([
    ['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'],
    ...slides.map((_, i) => [`rId${i + 2}`, 'slide', `slides/slide${i + 1}.xml`] as [string, string, string]),
    [`rId${n + 2}`, 'presProps', 'presProps.xml'],
    [`rId${n + 3}`, 'viewProps', 'viewProps.xml'],
    [`rId${n + 4}`, 'theme', 'theme/theme1.xml'],
    [`rId${n + 5}`, 'tableStyles', 'tableStyles.xml'],
  ]));
  zip.file('ppt/presProps.xml', `${XML}<p:presentationPr ${NS}/>`);
  zip.file('ppt/viewProps.xml', `${XML}<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`);
  zip.file('ppt/tableStyles.xml', `${XML}<a:tblStyleLst xmlns:a="${NS_A}" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`);
  zip.file('ppt/theme/theme1.xml', THEME);
  zip.file('ppt/slideMasters/slideMaster1.xml', MASTER);
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([
    ['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'],
    ['rId2', 'theme', '../theme/theme1.xml'],
  ]));
  zip.file('ppt/slideLayouts/slideLayout1.xml', LAYOUT);
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]));

  slides.forEach((s, i) => {
    const k = i + 1;
    zip.file(`ppt/slides/slide${k}.xml`, slideXml(s, cx, cy));
    const slideRels: [string, string, string][] = [['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']];
    if (s.image) {
      const ext = s.image.type === 'png' ? 'png' : 'jpeg';
      zip.file(`ppt/media/image${k}.${ext}`, s.image.bytes);
      slideRels.push(['rId2', 'image', `../media/image${k}.${ext}`]);
    }
    zip.file(`ppt/slides/_rels/slide${k}.xml.rels`, rels(slideRels));
  });

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: `${CT}.presentationml.presentation` });
}
