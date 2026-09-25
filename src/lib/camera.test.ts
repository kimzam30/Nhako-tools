import { describe, expect, it } from 'vitest';
import { ATTEMPTS, CameraError, cameraBlocker, isInAppBrowser, isLive, openCamera, platformOf, refusedBy } from './camera';

const fail = (name: string) => Object.assign(new Error(name), { name });
const fakeStream = (audio: boolean, state: 'live' | 'ended' = 'live') => ({
  getAudioTracks: () => (audio ? [{}] : []),
  getVideoTracks: () => [{ readyState: state }],
}) as unknown as MediaStream;

/** A getUserMedia that fails with the given errors in turn, then succeeds. */
function scripted(errors: string[], audio = true) {
  const asked: MediaStreamConstraints[] = [];
  const gum = async (c: MediaStreamConstraints) => {
    asked.push(c);
    const next = errors.shift();
    if (next) throw fail(next);
    return fakeStream(audio && c.audio !== false);
  };
  return { gum, asked };
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';
const INSTAGRAM = `${IPHONE} Instagram 340.0.0.0`;

describe('openCamera', () => {
  it('asks once, at full quality, when that works', async () => {
    const { gum, asked } = scripted([]);
    const cam = await openCamera(gum, ANDROID);
    expect(asked).toEqual([ATTEMPTS[0]]);
    expect(cam.audio).toBe(true);
  });

  it('steps down to a plainer request when the front camera refuses 1080p', async () => {
    const { gum, asked } = scripted(['OverconstrainedError']);
    await openCamera(gum, ANDROID);
    expect(asked).toHaveLength(2);
    expect(asked[1]).toEqual({ video: { facingMode: 'user' }, audio: true });
  });

  it('films without sound when only the microphone is missing', async () => {
    const { gum, asked } = scripted(['NotFoundError', 'NotFoundError', 'NotFoundError']);
    const cam = await openCamera(gum, ANDROID);
    expect(asked[3]!.audio).toBe(false);
    expect(cam.audio).toBe(false);
  });

  it('stops at the first "no": asking again would only be refused again', async () => {
    const { gum, asked } = scripted(['NotAllowedError']);
    await expect(openCamera(gum, IPHONE, async () => 'denied')).rejects.toMatchObject({ problem: 'blocked' });
    expect(asked).toHaveLength(1);
  });

  it('blames the system when the site holds the permission and is still refused', async () => {
    // Android with Chrome denied the camera in the phone's own settings.
    const { gum } = scripted(['NotAllowedError']);
    await expect(openCamera(gum, ANDROID, async () => 'granted')).rejects.toMatchObject({ problem: 'system' });
  });

  it('calls a refusal inside Instagram an in-app browser problem', async () => {
    const { gum } = scripted(['NotAllowedError']);
    await expect(openCamera(gum, INSTAGRAM)).rejects.toMatchObject({ problem: 'inapp' });
  });

  it('says busy when another app holds the camera, missing when there is none', async () => {
    const busy = scripted(Array(ATTEMPTS.length).fill('NotReadableError'));
    const err = await openCamera(busy.gum, ANDROID).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CameraError);
    expect((err as CameraError).problem).toBe('busy');
    expect(busy.asked).toHaveLength(ATTEMPTS.length);

    const none = scripted(Array(ATTEMPTS.length).fill('NotFoundError'));
    await expect(openCamera(none.gum, ANDROID)).rejects.toMatchObject({ problem: 'missing' });
  });
});

describe('cameraBlocker', () => {
  const ok = { isSecureContext: true, hasGetUserMedia: true, hasRecorder: true, ua: ANDROID };
  it('passes a normal secure page', () => expect(cameraBlocker(ok)).toBeNull());
  it('names plain http, where the browser removes the camera API', () =>
    expect(cameraBlocker({ ...ok, isSecureContext: false, hasGetUserMedia: false })).toBe('insecure'));
  it('names an in-app browser with no camera API', () =>
    expect(cameraBlocker({ ...ok, hasGetUserMedia: false, ua: INSTAGRAM })).toBe('inapp'));
  it('names a browser that cannot record', () => expect(cameraBlocker({ ...ok, hasRecorder: false })).toBe('unsupported'));
});

describe('refusedBy', () => {
  it('reads a denied site permission as the site', async () => {
    expect(await refusedBy(async (n) => (n === 'camera' ? 'denied' : 'granted'))).toBe('site');
  });
  it('reads granted as the system', async () => {
    expect(await refusedBy(async () => 'granted')).toBe('system');
  });
  it('falls back to the site when the browser cannot say', async () => {
    expect(await refusedBy(async () => 'unknown')).toBe('site');
    expect(await refusedBy(async () => 'prompt')).toBe('site');
  });
});

describe('helpers', () => {
  it('tells a live stream from an ended one', () => {
    expect(isLive(fakeStream(true))).toBe(true);
    expect(isLive(fakeStream(true, 'ended'))).toBe(false);
    expect(isLive(null)).toBe(false);
  });
  it('finds the platform, including an iPad asking for the desktop site', () => {
    expect(platformOf(IPHONE)).toBe('ios');
    expect(platformOf(IPAD_DESKTOP, 5)).toBe('ios');
    expect(platformOf(IPAD_DESKTOP, 0)).toBe('other');
    expect(platformOf(ANDROID)).toBe('android');
  });
  it('recognises in-app browsers and not real ones', () => {
    expect(isInAppBrowser(INSTAGRAM)).toBe(true);
    expect(isInAppBrowser(`${ANDROID.replace('Pixel 7)', 'Pixel 7; wv)')}`)).toBe(true);
    expect(isInAppBrowser(IPHONE)).toBe(false);
    expect(isInAppBrowser(ANDROID)).toBe(false);
  });
});
