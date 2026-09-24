/**
 * Tools with their own interface (kind 'app'). Listed here only so
 * loaders.test.ts can prove that every registered tool has an implementation.
 * Nothing in the client imports this file, so it creates no extra chunks.
 *
 * Most of these islands import their logic module directly. Merge, Split and
 * JPG to PDF do not: they are a bespoke STAGING interface over an unchanged
 * file-tool engine, so they go through run-tool.ts like any other file tool
 * and keep the worker with it. That is why those three appear both here and
 * in loaders.ts, and it is deliberate: the UI is bespoke, the engine is not.
 */
export const APPS: Record<string, () => Promise<unknown>> = {
  'image/passport-photo': () => import('./image/passport-photo'),
  'calc/take-home-pay': () => import('./calc/take-home'),
  'calc/cgpa': () => import('./calc/cgpa'),
  'pdf/organize': () => import('./pdf/organize'),
  'pdf/sign': () => import('./pdf/sign'),
  'image/crop': () => import('./image/crop'),
  'media/teleprompter': () => import('./media/teleprompter'),
  'pdf/scan': () => import('./pdf/scan'),
  'pdf/merge': () => import('./pdf/merge'),
  'pdf/split': () => import('./pdf/split'),
  'pdf/jpg-to-pdf': () => import('./pdf/jpg-to-pdf'),
};
