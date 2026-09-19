/**
 * Tools with their own interface (kind 'app'): their islands import these
 * logic modules directly. Listed here only so loaders.test.ts can prove that
 * every registered tool has an implementation. Nothing in the client imports
 * this file, so it creates no extra chunks.
 */
export const APPS: Record<string, () => Promise<unknown>> = {
  'image/passport-photo': () => import('./image/passport-photo'),
  'calc/take-home-pay': () => import('./calc/take-home'),
  'pdf/organize': () => import('./pdf/organize'),
  'pdf/sign': () => import('./pdf/sign'),
  'image/crop': () => import('./image/crop'),
  'media/teleprompter': () => import('./media/teleprompter'),
  'pdf/scan': () => import('./pdf/scan'),
};
