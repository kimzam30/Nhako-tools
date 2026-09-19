/** Crop geometry, in image pixels. */
export interface Rect { x: number; y: number; w: number; h: number }

export const RATIOS: Record<string, number | null> = {
  free: null, '1:1': 1, '4:5': 4 / 5, '3:4': 3 / 4, '4:3': 4 / 3, '16:9': 16 / 9, '9:16': 9 / 16,
};

/** The largest centred rectangle of `ratio` that fits the image. */
export function initialRect(imgW: number, imgH: number, ratio: number | null): Rect {
  if (!ratio) return { x: 0, y: 0, w: imgW, h: imgH };
  let w = imgW;
  let h = w / ratio;
  if (h > imgH) { h = imgH; w = h * ratio; }
  return { x: Math.round((imgW - w) / 2), y: Math.round((imgH - h) / 2), w: Math.round(w), h: Math.round(h) };
}

/** Keep a rectangle whole, at least 8 px, inside the image, and at the ratio if one is set. */
export function clampRect(r: Rect, imgW: number, imgH: number, ratio: number | null): Rect {
  let w = Math.max(8, Math.min(r.w, imgW));
  let h = Math.max(8, Math.min(r.h, imgH));
  if (ratio) {
    // Shrink whichever side overshoots so the ratio holds within the image.
    if (w / h > ratio) w = h * ratio; else h = w / ratio;
    if (w > imgW) { w = imgW; h = w / ratio; }
    if (h > imgH) { h = imgH; w = h * ratio; }
  }
  w = Math.round(w);
  h = Math.round(h);
  const x = Math.round(Math.min(Math.max(0, r.x), imgW - w));
  const y = Math.round(Math.min(Math.max(0, r.y), imgH - h));
  return { x, y, w, h };
}
