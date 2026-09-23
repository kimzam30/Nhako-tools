/**
 * The 43 tool marks.
 *
 * Every mark is ONE BASE with ONE OPERATION applied to it. Nothing is drawn
 * freehand, so no choice is arbitrary and a 44th tool draws itself by picking
 * from the existing vocabulary. The full mapping, and the reasoning for each,
 * is in `.design/redesign/INFORMATION_ARCHITECTURE.md` sections 1 and 2.
 *
 * Drawing spec, from `src/styles/tokens.css`:
 *   24 unit grid, 1.5 stroke, butt caps, miter joins.
 *   Butt and miter rather than round: precision reads sharp, and a rounded cap
 *   at 20px reads as a soft consumer icon.
 *
 * Connectors are routed ORTHOGONALLY, never as diagonals or curves. A signal
 * path on an instrument panel turns at right angles, and it is what separates
 * "merge" from a decorative swoosh.
 *
 * Marks are presentational. `ToolIcon.astro` renders them `aria-hidden`: a row
 * announces as one link named for its tool, and a mark repeating that name
 * would add noise and no information.
 */

/** Arrows squeezing inward from both sides at the vertical midpoint. */
const INWARD =
  '<path d="M1.2 12h4.3"/><path d="M3.1 9.6L5.5 12l-2.4 2.4"/>' +
  '<path d="M22.8 12h-4.3"/><path d="M20.9 9.6L18.5 12l2.4 2.4"/>';

/** A sweep across the base, with calibration ticks at each end. */
const SCAN = (x1: number, x2: number) =>
  `<path d="M${x1} 12h${x2 - x1}"/><path d="M${x1} 10.3v3.4"/><path d="M${x2} 10.3v3.4"/>`;

export const MARKS: Record<string, string> = {
  // ===== PDF, 18. Base: page. ==============================================
  'pdf/merge':
    '<path d="M1.5 2.6h3.4l2 2v5.4H1.5z"/><path d="M4.9 2.6v2h2"/>' +
    '<path d="M1.5 14h3.4l2 2v5.4H1.5z"/><path d="M4.9 14v2h2"/>' +
    '<path d="M6.9 6.3h4.6V12h8"/><path d="M6.9 17.7h4.6V12"/>' +
    '<path d="M17.6 9.7L20.3 12l-2.7 2.3"/>',
  'pdf/split':
    '<path d="M1.5 7.3h3.9l2.5 2.5v6.9H1.5z"/><path d="M5.4 7.3v2.5h2.5"/>' +
    '<path d="M7.9 12h3.6V6.9h8"/><path d="M11.5 12v5.1h8"/>' +
    '<path d="M17.6 4.6L20.3 6.9l-2.7 2.3"/>' +
    '<path d="M17.6 14.8L20.3 17.1l-2.7 2.3"/>',
  'pdf/rotate':
    '<path d="M2.6 7.4h6.6l3.2 3.2v10.8H2.6z"/><path d="M9.2 7.4v3.2h3.2"/>' +
    '<path d="M13.4 4.4a6.4 6.4 0 0 1 6.4 6.4"/><path d="M17.2 9.8l2.6 1 1-2.6"/>',
  /* Three sheets with the middle one lifted out of line. The middle carries a
     folded corner so the set reads as pages rather than as a bar chart. */
  'pdf/organize':
    '<path d="M1.6 8.6h5.6v12.2H1.6z"/>' +
    '<path d="M9.2 3.8h3.4l2.2 2.2V16H9.2z"/><path d="M12.6 3.8v2.2h2.2"/>' +
    '<path d="M16.8 8.6h5.6v12.2h-5.6z"/>',
  'pdf/crop':
    '<path d="M5.8 2.6v15.6h15.6"/><path d="M2.6 5.8h15.6v15.6"/>' +
    '<path d="M8.6 8.6h4.2l2.4 2.4v4.4"/><path d="M12.8 8.6v2.4h2.4"/>',
  'pdf/jpg-to-pdf':
    '<path d="M1.4 6.8h8v10.4h-8z"/><circle cx="4" cy="9.8" r=".9"/>' +
    '<path d="M1.4 15.4l2.6-2.6 1.8 1.8 1.6-1.8 2 2"/>' +
    '<path d="M10.8 12h3.4"/><path d="M12.4 10.2L14.2 12l-1.8 1.8"/>' +
    '<path d="M15.6 6.8h3.5l3.3 3.3v7.1h-6.8z"/><path d="M19.1 6.8v3.3h3.3"/>',
  'pdf/office-to-pdf':
    '<path d="M1.4 5.6h4.4l2.6 2.6v10.2H1.4z"/><path d="M5.8 5.6v2.6h2.6"/>' +
    '<path d="M3.2 11.4h3.2"/><path d="M3.2 14.4h3.2"/>' +
    '<path d="M10.8 12h3.4"/><path d="M12.4 10.2L14.2 12l-1.8 1.8"/>' +
    '<path d="M15.6 6.8h3.5l3.3 3.3v7.1h-6.8z"/><path d="M19.1 6.8v3.3h3.3"/>',
  'pdf/scan':
    '<path d="M2.6 8.2V3.4h4.8"/><path d="M21.4 8.2V3.4h-4.8"/>' +
    '<path d="M2.6 15.8v4.8h4.8"/><path d="M21.4 15.8v4.8h-4.8"/>' +
    '<path d="M8.6 8.4h4.2l2.4 2.4v4.8H8.6z"/><path d="M12.8 8.4v2.4h2.4"/>',
  'pdf/to-image':
    '<path d="M1.4 6.8h3.5l3.3 3.3v7.1H1.4z"/><path d="M4.9 6.8v3.3h3.3"/>' +
    '<path d="M9.8 12h3.4"/><path d="M11.4 10.2L13.2 12l-1.8 1.8"/>' +
    '<path d="M14.6 6.8h8v10.4h-8z"/><circle cx="17.2" cy="9.8" r=".9"/>' +
    '<path d="M14.6 15.4l2.6-2.6 1.8 1.8 1.6-1.8 2 2"/>',
  'pdf/to-text':
    '<path d="M1.4 6.8h3.5l3.3 3.3v7.1H1.4z"/><path d="M4.9 6.8v3.3h3.3"/>' +
    '<path d="M9.8 12h3.4"/><path d="M11.4 10.2L13.2 12l-1.8 1.8"/>' +
    '<path d="M14.8 8.6h7.8"/><path d="M14.8 12h7.8"/><path d="M14.8 15.4h5.2"/>',
  'pdf/to-word':
    '<path d="M1.4 6.8h3.5l3.3 3.3v7.1H1.4z"/><path d="M4.9 6.8v3.3h3.3"/>' +
    '<path d="M9.8 12h3.4"/><path d="M11.4 10.2L13.2 12l-1.8 1.8"/>' +
    '<path d="M15.2 5.6h4.2l3.2 3.2v9.6h-7.4z"/><path d="M19.4 5.6v3.2h3.2"/>' +
    '<path d="M17 12.2h3.4"/><path d="M17 15h3.4"/>',
  'pdf/ocr':
    '<path d="M6 2.6h8.4L18 6.2v15.2H6z"/><path d="M14.4 2.6v3.6H18"/>' +
    '<path d="M8.6 8.9h6.8"/><path d="M8.6 15.4h6.8"/>' +
    SCAN(3.2, 20.8),
  'pdf/watermark':
    '<path d="M6 2.6h8.4L18 6.2v15.2H6z"/><path d="M14.4 2.6v3.6H18"/>' +
    '<path d="M7.4 17.6L17 7"/><path d="M7.4 12.4L13.2 6.4"/>',
  /* The stroke stays INSIDE the sheet and sits on a ruled line. The first pass
     began it outside the page and it read as a detached hook. */
  'pdf/sign':
    '<path d="M5 2.6h8.4L17 6.2v15.2H5z"/><path d="M13.4 2.6v3.6H17"/>' +
    '<path d="M7.4 16.8c1.5-3.2 2.7-3.2 3.3-1s1.9 1.1 3.3-1.3"/>' +
    '<path d="M7.4 19.4h7.2"/>' +
    '<path d="M19 19.6l3 1.8"/>',
  'pdf/page-numbers':
    '<path d="M6 2.6h8.4L18 6.2v9.6"/><path d="M6 21.4V2.6"/>' +
    '<path d="M14.4 2.6v3.6H18"/>' +
    '<path d="M8.4 8.4h7"/><path d="M8.4 12h7"/>' +
    '<path d="M13.4 17.4h8.6v4.2h-8.6z"/><path d="M16 18.8v1.4"/><path d="M19.4 18.8v1.4"/>',
  'pdf/compress':
    '<path d="M7.5 4.6h6l3 3v11.8h-9z"/><path d="M13.5 4.6v3h3"/>' +
    INWARD,
  'pdf/protect':
    '<path d="M2.6 2.6h7.3l3.8 3.8v5.2"/><path d="M13.7 21.4H2.6V2.6"/>' +
    '<path d="M9.9 2.6v3.8h3.8"/>' +
    '<path d="M12.8 13.4h9.4v7.9h-9.4z"/>' +
    '<path d="M15.2 13.4v-2.1a2.3 2.3 0 0 1 4.6 0v2.1"/>',
  'pdf/unlock':
    '<path d="M2.6 2.6h7.3l3.8 3.8v5.2"/><path d="M13.7 21.4H2.6V2.6"/>' +
    '<path d="M9.9 2.6v3.8h3.8"/>' +
    '<path d="M12.8 13.4h9.4v7.9h-9.4z"/>' +
    '<path d="M15.2 13.4v-2.1a2.3 2.3 0 0 1 4.6 0"/>',

  // ===== Image, 11. Base: photo. ===========================================
  'image/compress':
    '<path d="M7.5 6.6h9v10.8h-9z"/><circle cx="10.1" cy="9.6" r="1"/>' +
    '<path d="M7.5 15.6l3.2-3.2 2.1 2.1 1.9-1.9 1.8 1.8"/>' +
    INWARD,
  'image/convert':
    '<path d="M4.4 7.8h15.2v10.8H4.4z"/><circle cx="7.6" cy="11" r="1"/>' +
    '<path d="M4.4 16.8l3.6-3.6 2.4 2.4 2.4-2.6 6.8 6.6"/>' +
    '<path d="M4.8 5.2h12.6"/><path d="M15.4 3.2l2.2 2-2.2 2"/>',
  'image/heic-to-jpg':
    '<path d="M1.4 6.8h8v10.4h-8z"/><circle cx="4" cy="9.8" r=".9"/>' +
    '<path d="M1.4 15.4l2.6-2.6 1.8 1.8 1.6-1.8 2 2"/>' +
    '<path d="M10.8 12h3.4"/><path d="M12.4 10.2L14.2 12l-1.8 1.8"/>' +
    '<path d="M14.6 6.8h8v10.4h-8z"/><circle cx="17.2" cy="9.8" r=".9"/>' +
    '<path d="M14.6 15.4l2.6-2.6 1.8 1.8 1.6-1.8 2 2"/>',
  'image/resize':
    '<path d="M2.6 5.4h12.2v12.2H2.6z"/><circle cx="5.6" cy="8.4" r=".9"/>' +
    '<path d="M2.6 15.8l2.8-2.8 2 2 2-2.2 2.4 2.4"/>' +
    '<path d="M12.4 21.4h9v-9"/><path d="M14.8 19l6.6-6.6"/>',
  'image/crop':
    '<path d="M5.8 2.6v15.6h15.6"/><path d="M2.6 5.8h15.6v15.6"/>' +
    '<circle cx="9.8" cy="9.8" r="1"/>' +
    '<path d="M7.4 15.2l2.8-2.8 2 2 2.2-2.4 2.2 2.4"/>',
  'image/rotate':
    '<path d="M2.6 8.6h10.2v10.2H2.6z"/><circle cx="5.4" cy="11.2" r=".9"/>' +
    '<path d="M2.6 17l2.6-2.6 1.8 1.8 1.8-2 2.2 2.2"/>' +
    '<path d="M13.4 4.4a6.4 6.4 0 0 1 6.4 6.4"/><path d="M17.2 9.8l2.6 1 1-2.6"/>',
  'image/watermark':
    '<path d="M3.4 5.4h17.2v13.2H3.4z"/><circle cx="6.8" cy="8.8" r="1"/>' +
    '<path d="M3.4 16.6l3.4-3.4 2.2 2.2 2.4-2.6 6 6"/>' +
    '<path d="M7 17.2L16.4 7.8"/><path d="M7 12.4l4.8-4.6"/>',
  'image/remove-background':
    '<path d="M3.4 5.4h6.2"/><path d="M13.2 5.4h6.2"/><path d="M19.4 5.4v5.4"/>' +
    '<path d="M19.4 14.4v4.2h-4.6"/><path d="M11 18.6H3.4v-4.2"/><path d="M3.4 10.8V5.4"/>' +
    '<path d="M8.4 18.6c0-3.4 1.6-5.2 3.6-5.2s3.6 1.8 3.6 5.2"/>' +
    '<circle cx="12" cy="9.8" r="2.4"/>',
  'image/remove-metadata':
    '<path d="M2.6 5.4h13.4v13.2H2.6z"/><circle cx="5.8" cy="8.6" r="1"/>' +
    '<path d="M2.6 16.6l3.2-3.2 2.2 2.2 2.2-2.4 5.8 5.4"/>' +
    '<path d="M15.6 5.2h6.2v4.2h-6.2z"/><path d="M14.4 11.2l8.6-7.4"/>',
  'image/ocr':
    '<path d="M4.8 4.8h14.4v14.4H4.8z"/><circle cx="8.6" cy="8.8" r="1.2"/>' +
    '<path d="M4.8 16.2l3.9-3.9 2.4 2.4 3.6-4 4.5 5"/>' +
    SCAN(2.2, 21.8),
  'image/passport-photo':
    '<path d="M4.6 2.6h14.8v18.8H4.6z"/>' +
    '<circle cx="12" cy="9.4" r="3"/>' +
    '<path d="M6.8 18.6c0-3 2.2-4.6 5.2-4.6s5.2 1.6 5.2 4.6"/>' +
    '<path d="M2.2 5.4h1.4"/><path d="M2.2 12h1.4"/><path d="M2.2 18.6h1.4"/>',

  // ===== Media, 4. Bases: frame, wave, text. ===============================
  'media/compress-video':
    '<path d="M7.5 6.6h9v10.8h-9z"/><path d="M11 9.6L14.7 12 11 14.4z"/>' +
    INWARD,
  'media/extract-audio':
    '<path d="M2.6 4.6h11.8v11.8H2.6z"/><path d="M6.6 7.8L10.8 10.5 6.6 13.2z"/>' +
    '<path d="M14.6 21v-4.6"/><path d="M17.4 21v-8.4"/><path d="M20.2 21v-6"/>',
  'media/transcribe':
    '<path d="M1.6 9.4v5.2"/><path d="M4.4 6.4v11.2"/><path d="M7.2 8.6v6.8"/>' +
    '<path d="M9.8 12h3.4"/><path d="M11.4 10.2L13.2 12l-1.8 1.8"/>' +
    '<path d="M14.8 8.6h7.8"/><path d="M14.8 12h7.8"/><path d="M14.8 15.4h5.2"/>',
  'media/teleprompter':
    '<path d="M3.4 8.6h17.2"/><path d="M3.4 12.4h17.2"/><path d="M3.4 16.2h11.4"/>' +
    '<path d="M12 5.4V1.8"/><path d="M9.8 3.6L12 1.4l2.2 2.2"/>',

  // ===== Developer, 9. Bases: braces, text, token, grid, box. ==============
  'dev/json':
    '<path d="M8.4 3.4C5.8 3.4 6.6 10 4 10c2.6 0 1.8 6.6 4.4 6.6"/>' +
    '<path d="M15.6 3.4c2.6 0 1.8 6.6 4.4 6.6-2.6 0-1.8 6.6-4.4 6.6"/>' +
    '<path d="M9.4 20.6h5.2"/><path d="M11.8 8h4"/><path d="M11.8 12h2.2"/>',
  'dev/diff':
    '<path d="M2.6 3.6h7.4v16.8H2.6z"/><path d="M14 3.6h7.4v16.8H14z"/>' +
    '<path d="M4.6 8.4h3.4"/><path d="M4.6 12h3.4"/>' +
    '<path d="M16 8.4h3.4"/><path d="M16 15.6h3.4"/>' +
    '<path d="M12 2.6v18.8"/>',
  'dev/word-count':
    '<path d="M2.6 5.6h18.8"/><path d="M2.6 10h18.8"/><path d="M2.6 14.4h11.4"/>' +
    '<path d="M13.4 17.6h8.6v4.2h-8.6z"/><path d="M16 19v1.4"/><path d="M19.4 19v1.4"/>',
  'dev/base64':
    '<path d="M2.6 8h11.4"/><path d="M2.6 12h8.4"/><path d="M2.6 16h11.4"/>' +
    '<path d="M16.4 6.4h5v5"/><path d="M21.4 6.4L16.6 11.2"/>' +
    '<path d="M21.4 17.6h-5v-5"/><path d="M16.4 17.6l4.8-4.8"/>',
  'dev/jwt':
    '<path d="M1.6 9.4h6v5.2h-6z"/>' +
    '<path d="M7.6 12h3.2V6.4h4.6"/><path d="M10.8 12v5.6h4.6"/>' +
    '<path d="M15.4 3.8h6.4v5.2h-6.4z"/><path d="M15.4 15h6.4v5.2h-6.4z"/>',
  'dev/hash':
    '<path d="M1.6 8.4h8.4"/><path d="M1.6 12h5.6"/><path d="M1.6 15.6h8.4"/>' +
    '<path d="M11.6 12h3.4"/><path d="M13.2 10.2L15 12l-1.8 1.8"/>' +
    '<path d="M16.4 6.6h6v10.8h-6z"/><path d="M18.2 10.4h2.4"/><path d="M18.2 13.6h2.4"/>',
  'dev/uuid':
    '<path d="M1.6 9.4h5.8v5.2H1.6z"/><path d="M9.2 9.4h5.8v5.2H9.2z"/>' +
    '<path d="M16.8 9.4h5.8v5.2h-5.8z"/>' +
    '<path d="M19.7 4.2V1.6"/><path d="M17.4 5.2L16 3.2"/><path d="M22 5.2l1.4-2"/>',
  'dev/qr':
    '<path d="M2.6 2.6h7v7h-7z"/><path d="M14.4 2.6h7v7h-7z"/>' +
    '<path d="M2.6 14.4h7v7h-7z"/>' +
    '<path d="M5.2 5.2h1.8v1.8H5.2z"/><path d="M17 5.2h1.8v1.8H17z"/>' +
    '<path d="M5.2 17h1.8v1.8H5.2z"/>' +
    '<path d="M14.4 14.4h3v3h-3z"/><path d="M19.4 19.4h2.2v2.2h-2.2z"/>',
  'dev/css-shadow':
    '<path d="M2.6 2.6h13v13h-13z"/><path d="M8.4 21.4h13v-13"/>' +
    '<path d="M18.2 18.6h1"/><path d="M14.2 18.6h1"/><path d="M18.6 14.2v1"/>',

  // ===== Calculators, 1. Base: ledger. =====================================
  'calc/take-home-pay':
    '<path d="M4.6 2.6h14.8v18.8H4.6z"/>' +
    '<path d="M7 6.6h5.6"/><path d="M15 6.6h2"/>' +
    '<path d="M7 10.4h5.6"/><path d="M15 10.4h2"/>' +
    '<path d="M7 14.2h9.8"/>' +
    '<path d="M7 18h4"/><path d="M14.2 18h2.8"/>',
};

/** Every tool id that has a mark. Used by the registry test. */
export const MARKED = Object.keys(MARKS);
