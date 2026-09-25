/**
 * Opening the front camera and the microphone for the teleprompter.
 *
 * On a laptop one getUserMedia call either works or it does not. On phones and
 * tablets it fails in more ways, and most of them are recoverable:
 * - a front camera that will not open at 1080p (OverconstrainedError, or a
 *   NotReadableError from an Android driver) opens fine with no size asked;
 * - a tablet with no usable microphone should still film, without sound;
 * - "blocked" and "busy" need different instructions, and "blocked" must not be
 *   retried silently: the browser answers the same way until the person
 *   changes the setting.
 * A page cannot force a permission. What it can do is ask from a tap (where
 * every browser shows the prompt), ask once rather than twice at the same time
 * (a second request on iOS mutes the first stream's picture), and, when the
 * answer is no, say exactly where the setting is. There are two places: the
 * site's permission in the browser, and the browser's own permission in the
 * phone's settings. Found on the Android emulator (2026-09-25): with Chrome
 * denied the camera by Android, the site reads as granted and getUserMedia
 * still says NotAllowedError, so pointing at the site setting was a dead end.
 */

export type CameraProblem = 'insecure' | 'inapp' | 'unsupported' | 'blocked' | 'system' | 'busy' | 'missing';

export class CameraError extends Error {
  constructor(readonly problem: CameraProblem, readonly cause?: unknown) {
    super(problem);
    this.name = 'CameraError';
  }
}

export interface OpenedCamera {
  stream: MediaStream;
  /** False when only the picture could be opened: the take will be silent. */
  audio: boolean;
}

type GetUserMedia = (c: MediaStreamConstraints) => Promise<MediaStream>;
type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';
type QueryPermission = (name: 'camera' | 'microphone') => Promise<PermissionState>;

const queryPermission: QueryPermission = async (name) => {
  try {
    return (await navigator.permissions.query({ name: name as PermissionName })).state;
  } catch {
    return 'unknown';
  }
};

/**
 * A refusal while the site itself holds the permission came from the system:
 * the phone has denied the browser the camera (or the microphone).
 */
export async function refusedBy(query: QueryPermission = queryPermission): Promise<'site' | 'system'> {
  const states = await Promise.all([query('camera'), query('microphone')]);
  return !states.includes('denied') && states.includes('granted') ? 'system' : 'site';
}

/** Tried in order, each plainer than the one before. */
export const ATTEMPTS: readonly MediaStreamConstraints[] = [
  {
    video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
    audio: { echoCancellation: true, noiseSuppression: true },
  },
  { video: { facingMode: 'user' }, audio: true },
  { video: true, audio: true },
  // Picture only: a microphone that is missing or held by another app.
  { video: { facingMode: 'user' }, audio: false },
  { video: true, audio: false },
];

const errorName = (e: unknown) => (e && typeof e === 'object' && 'name' in e ? String((e as { name: unknown }).name) : '');

/** The answers that mean the person, or a policy, said no. Retrying cannot change them. */
const BLOCKED = new Set(['NotAllowedError', 'SecurityError', 'PermissionDeniedError']);
/** Another app or tab holds the camera, or the OS refused to start it. */
const BUSY = new Set(['NotReadableError', 'TrackStartError', 'AbortError']);

/**
 * Instagram, Facebook, TikTok, WhatsApp and similar open links in their own
 * web view, and most of those never pass a camera request on to the system.
 */
export function isInAppBrowser(ua: string): boolean {
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|TikTok|musical_ly|Snapchat|MicroMessenger|Twitter|; wv\)/i.test(ua);
}

/** Why the camera cannot even be asked for, or null when it can. */
export function cameraBlocker(env: {
  isSecureContext: boolean;
  hasGetUserMedia: boolean;
  hasRecorder: boolean;
  ua: string;
}): CameraProblem | null {
  // Browsers remove navigator.mediaDevices entirely on plain http (a phone
  // opening a laptop's dev server by its LAN address is the common case).
  if (!env.isSecureContext) return 'insecure';
  if (!env.hasGetUserMedia) return isInAppBrowser(env.ua) ? 'inapp' : 'unsupported';
  if (!env.hasRecorder) return 'unsupported';
  return null;
}

export function currentCameraBlocker(): CameraProblem | null {
  return cameraBlocker({
    isSecureContext: globalThis.isSecureContext !== false,
    hasGetUserMedia: typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
    hasRecorder: typeof MediaRecorder !== 'undefined',
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  });
}

/** Open the camera, stepping down through {@link ATTEMPTS}. Throws a {@link CameraError}. */
export async function openCamera(
  gum: GetUserMedia = (c) => navigator.mediaDevices.getUserMedia(c),
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  query: QueryPermission = queryPermission,
): Promise<OpenedCamera> {
  let last: unknown;
  for (const constraints of ATTEMPTS) {
    try {
      const stream = await gum(constraints);
      return { stream, audio: stream.getAudioTracks().length > 0 };
    } catch (e) {
      last = e;
      if (BLOCKED.has(errorName(e))) {
        if (isInAppBrowser(ua)) throw new CameraError('inapp', e);
        throw new CameraError((await refusedBy(query)) === 'system' ? 'system' : 'blocked', e);
      }
    }
  }
  throw new CameraError(BUSY.has(errorName(last)) ? 'busy' : 'missing', last);
}

/** A stream whose picture is still coming in. Ended tracks show a black box forever. */
export function isLive(stream: MediaStream | null): stream is MediaStream {
  return Boolean(stream?.getVideoTracks().some((t) => t.readyState === 'live'));
}

export type Platform = 'ios' | 'android' | 'other';

/** Where the site's camera setting lives, which differs by system rather than by browser. */
export function platformOf(ua: string, maxTouchPoints = 0): Platform {
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  // iPadOS asks for the desktop site and reports itself as a Mac.
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}
