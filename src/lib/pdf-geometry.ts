/**
 * Mapping between what a reader SEES on a PDF page and the page's own
 * coordinate space.
 *
 * A page can carry /Rotate 90, 180 or 270: its content is stored one way and
 * shown turned clockwise. Scanned documents do this all the time. Anything
 * placed "at the bottom right" or "cropped from the top" has to be placed in
 * stored (user) space, or it lands on the wrong edge, sideways.
 *
 * Visual coordinates here: origin at the top-left of the page as displayed,
 * x to the right, y DOWN, in points. User coordinates: PDF's own, origin at
 * the bottom-left of the unrotated crop box, y up.
 */

export type Rotation = 0 | 90 | 180 | 270;

export interface Box { x: number; y: number; width: number; height: number }

export const normalizeRotation = (deg: number): Rotation => ((((Math.round(deg / 90) * 90) % 360) + 360) % 360) as Rotation;

/** Size of the page as displayed. */
export function visualSize(box: Box, rotation: Rotation) {
  return rotation === 90 || rotation === 270
    ? { width: box.height, height: box.width }
    : { width: box.width, height: box.height };
}

/** A displayed point (top-left origin, y down) to user space. */
export function visualToUser(vx: number, vy: number, box: Box, rotation: Rotation) {
  const { x, y, width: W, height: H } = box;
  switch (rotation) {
    case 90: return { x: x + vy, y: y + vx };
    case 180: return { x: x + W - vx, y: y + vy };
    case 270: return { x: x + W - vy, y: y + H - vx };
    default: return { x: x + vx, y: y + H - vy };
  }
}

/** A displayed rectangle (top-left origin) to a user-space box. */
export function visualRectToUser(v: Box, box: Box, rotation: Rotation): Box {
  const a = visualToUser(v.x, v.y, box, rotation);
  const b = visualToUser(v.x + v.width, v.y + v.height, box, rotation);
  return {
    x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y),
  };
}

/**
 * Where to anchor something drawn so it reads upright on screen: pdf-lib
 * draws text and images from their bottom-left corner and rotates
 * anticlockwise, so pass the displayed bottom-left point and `rotate: rotation`.
 */
export function uprightAnchor(visualLeft: number, visualBottom: number, box: Box, rotation: Rotation) {
  return { ...visualToUser(visualLeft, visualBottom, box, rotation), rotate: rotation };
}

export const mmToPt = (mm: number) => (mm / 25.4) * 72;
