/**
 * Passport and application photos: presets, geometry, and output encoding.
 *
 * The interactive part lives in components/react/PhotoMaker.tsx; everything
 * here is plain arithmetic or canvas work that can be tested on its own.
 */
import { surface, toBlob } from '../../lib/canvas';
import { fitToSize } from '../../lib/fit-size';

export interface PhotoPreset {
  id: string;
  widthMm: number;
  heightMm: number;
  /** Crown-to-chin height as a share of the photo height, for the guide. */
  face: number;
  /** Background the issuer asks for, or null when it is up to you. */
  background: string | null;
  /** Upload limit for the digital file, in bytes. */
  maxBytes?: number;
  source?: { title: string; url: string; checked: string };
}

/**
 * Only requirements read from the issuer's own page are presets. Anything
 * else is left to "Custom", so no preset ever claims a rule nobody checked.
 */
export const PRESETS: readonly PhotoPreset[] = [
  {
    id: 'my-passport-child',
    widthMm: 35, heightMm: 50, face: 0.55, background: '#ffffff',
    source: {
      title: 'Jabatan Imigresen Malaysia, Malaysian International Passport: photo specifications',
      url: 'https://www.imi.gov.my/index.php/en/main-services/passport/malaysian-international-passport/',
      checked: '2026-09-18',
    },
  },
  {
    id: 'spa-myresume',
    // "Ukuran wajah tidak memenuhi 70% gambar" is one of SPA's rejected
    // examples, so the guide asks for the face to fill about 70%.
    widthMm: 35, heightMm: 50, face: 0.7, background: '#ffffff', maxBytes: 1_000_000,
    source: {
      title: 'SPA MyRésumé, Panduan Gambar',
      url: 'https://myresume.spa.gov.my/panduan/PANDUAN_GAMBAR.pdf',
      checked: '2026-09-18',
    },
  },
  { id: 'custom', widthMm: 35, heightMm: 50, face: 0.55, background: null },
];

export const DIGITAL_DPI = 600;
export const PRINT_DPI = 300;

export const mmToPx = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);

/** 4R: 6 x 4 inches, the standard print size at any Malaysian photo shop. */
export const SHEET = { widthIn: 6, heightIn: 4 } as const;

export interface SheetLayout {
  width: number;
  height: number;
  photoW: number;
  photoH: number;
  cols: number;
  rows: number;
  /** Top-left corner of each photo, in sheet pixels. */
  slots: { x: number; y: number }[];
}

/** As many copies as fit on a 4R sheet, with a 2 mm cutting gutter. */
export function sheetLayout(preset: Pick<PhotoPreset, 'widthMm' | 'heightMm'>, dpi = PRINT_DPI): SheetLayout {
  const width = SHEET.widthIn * dpi;
  const height = SHEET.heightIn * dpi;
  const photoW = mmToPx(preset.widthMm, dpi);
  const photoH = mmToPx(preset.heightMm, dpi);
  const gap = mmToPx(2, dpi);
  const cols = Math.max(0, Math.floor((width - gap) / (photoW + gap)));
  const rows = Math.max(0, Math.floor((height - gap) / (photoH + gap)));
  // Centre the block so the margins are even on every side.
  const x0 = Math.round((width - (cols * photoW + (cols - 1) * gap)) / 2);
  const y0 = Math.round((height - (rows * photoH + (rows - 1) * gap)) / 2);
  const slots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) slots.push({ x: x0 + c * (photoW + gap), y: y0 + r * (photoH + gap) });
  }
  return { width, height, photoW, photoH, cols, rows, slots };
}

/** Where the photo frame sits over the source image. */
export interface View {
  /** 1 = the image just covers the frame; larger zooms in. */
  zoom: number;
  /** Frame centre, in source pixels. */
  cx: number;
  cy: number;
}

/** Output pixels per source pixel at zoom 1, for a frame of `w` x `h`. */
export const coverScale = (srcW: number, srcH: number, w: number, h: number) => Math.max(w / srcW, h / srcH);

/** Keep the frame inside the image so no edge is ever left empty. */
export function clampView(v: View, srcW: number, srcH: number, frameW: number, frameH: number): View {
  const zoom = Math.min(8, Math.max(1, v.zoom));
  const scale = coverScale(srcW, srcH, frameW, frameH) * zoom;
  const halfW = frameW / scale / 2;
  const halfH = frameH / scale / 2;
  return {
    zoom,
    cx: Math.min(srcW - halfW, Math.max(halfW, v.cx)),
    cy: Math.min(srcH - halfH, Math.max(halfH, v.cy)),
  };
}

type Source = CanvasImageSource & { width: number; height: number };

/** Draw the framed part of `src` into a `w` x `h` canvas. */
export function renderFrame(src: Source, view: View, w: number, h: number, background: string | null) {
  const canvas = surface(w, h);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.fillStyle = background ?? '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const scale = coverScale(src.width, src.height, w, h) * view.zoom;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, w / 2 - view.cx * scale, h / 2 - view.cy * scale, src.width * scale, src.height * scale);
  return canvas;
}

/**
 * Write a resolution into a baseline JPEG's JFIF header.
 *
 * Canvas encoders write "no units, 1:1". Printing software then guesses the
 * size, and a 35 x 50 mm photo comes out at whatever it guessed. With the dpi
 * recorded, "actual size" printing lands on the exact millimetres.
 */
export function setJpegDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  const isJfif = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[3] === 0xe0
    && String.fromCharCode(...bytes.subarray(6, 11)) === 'JFIF\0';
  if (!isJfif) return bytes;
  const out = bytes.slice();
  out[13] = 1; // units: dots per inch
  out[14] = dpi >> 8; out[15] = dpi & 0xff; // X density
  out[16] = dpi >> 8; out[17] = dpi & 0xff; // Y density
  return out;
}

async function jpegWithDpi(canvas: ReturnType<typeof surface>, quality: number, dpi: number): Promise<Blob> {
  const blob = await toBlob(canvas, 'image/jpeg', quality);
  const bytes = setJpegDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: 'image/jpeg' });
}

/** The digital photo at 600 dpi, squeezed under the preset's upload limit if it has one. */
export async function digitalPhoto(src: Source, view: View, preset: PhotoPreset, background: string | null) {
  const w = mmToPx(preset.widthMm, DIGITAL_DPI);
  const h = mmToPx(preset.heightMm, DIGITAL_DPI);
  const canvas = renderFrame(src, view, w, h, background);
  if (!preset.maxBytes) return { blob: await jpegWithDpi(canvas, 0.92, DIGITAL_DPI), width: w, height: h, fits: true };
  const fit = await fitToSize((q) => jpegWithDpi(canvas, q, DIGITAL_DPI), preset.maxBytes, { scales: [1], minQuality: 0.5 });
  return { blob: fit.blob, width: w, height: h, fits: fit.fits };
}

/** A 4R sheet of copies with light cut marks, at 300 dpi. */
export async function printSheet(src: Source, view: View, preset: PhotoPreset, background: string | null) {
  const layout = sheetLayout(preset);
  const photo = renderFrame(src, view, layout.photoW, layout.photoH, background);
  const sheet = surface(layout.width, layout.height);
  const ctx = sheet.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.strokeStyle = '#c8c8cc';
  ctx.lineWidth = 1;
  for (const { x, y } of layout.slots) {
    ctx.drawImage(photo, x, y);
    ctx.strokeRect(x - 0.5, y - 0.5, layout.photoW + 1, layout.photoH + 1);
  }
  return { blob: await jpegWithDpi(sheet, 0.95, PRINT_DPI), copies: layout.slots.length };
}
