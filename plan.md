# plan.md: Nhako Tools as an Android APK

Written 2026-09-29. Every fact marked **verified** was checked today, on this
machine or at its source; anything else is in "Not verified" at the end.
Background and the longer rationale live in
[docs/pwa-and-android.md](docs/pwa-and-android.md); this is the plan to act on.

## Decision

**Ship a Trusted Web Activity (TWA) built with Bubblewrap**, package id
`com.nhako.tools`, not a WebView wrapper (Capacitor, Cordova).

A TWA is a real Android app (launcher icon, app drawer, Play Store listing,
its own task in Recents) that shows tools.nhako.com in the user's own Chrome,
full screen, with no browser UI. Why that and not a WebView:

| Needs | TWA | WebView wrapper |
|---|---|---|
| `SharedArrayBuffer` for ffmpeg.wasm and the heavy tools (COOP/COEP) | **verified working**: `crossOriginIsolated === true` inside the test APK | Android WebView does not give a page cross-origin isolation the same way; would need re-architecting every heavy tool (not verified here) |
| WebCodecs H.264 (the new 34x faster video compressor) | **verified**: `VideoEncoder` supports `avc1` inside the test APK | depends on the WebView version |
| Updates | every web deploy reaches the app instantly | same, unless assets are bundled |
| Size | **verified 1.0 MB** APK | several MB |
| Motion, view transitions, speculation rules | Chrome's, same as the site | WebView lags Chrome |

## What was proven today (2026-09-29)

1. **The build works, non-interactively.** `scripts/twa-build.mjs` (new)
   drives `@bubblewrap/core` 1.25.0 (published 2026-09-28) from the live
   manifest: TWA project, `gradle assembleRelease` (84 s), zipalign, apksigner.
   The repo script was then run end to end too: signed APK and a signed
   `.aab` (`jarsigner -verify`: "jar verified"). Output: `com.nhako.tools`
   1.0.0, **targetSdk 36, compileSdk 36**, 1,037,630
   bytes, launcher label "Nhako", 4 app shortcuts, maskable icon.
2. **It meets Play's current target rule.** Play Console Help: new apps and
   updates "must target Android 16 (API level 36) or higher" from
   **31 August 2026** (extension possible to 1 November 2026). Bubblewrap
   1.25's template sets 36. **Verified** at
   support.google.com/googleplay/android-developer/answer/11926878.
3. **It installs and runs** on the Android 15 emulator (`Medium_Phone_API_35`):
   `adb install` succeeded; the launcher opened `https://tools.nhako.com/?source=twa`.
4. **Without Digital Asset Links it is NOT full screen.**
   `https://tools.nhako.com/.well-known/assetlinks.json` returns **404** today,
   so Chrome fell back to a Custom Tab with a URL bar (screenshot taken). With
   verification bypassed on the emulator (Chrome's
   `--disable-digital-asset-link-verification-for-url` developer flag, removed
   again afterwards) it ran **full screen, no URL bar**. So assetlinks.json is
   the one hard blocker, and it can only be written once the signing key exists.
5. **Inside the app** (read over DevTools from the emulator): `crossOriginIsolated`
   true, `SharedArrayBuffer` present, `display-mode: standalone` true,
   `document.referrer === "android-app://com.nhako.tools/"`, WebCodecs H.264
   encoding supported.
6. **The coffee link is already handled.** Play's Payments policy exempts only
   "tax exempt donations" from Play billing (verified verbatim, section 3.2 of
   support.google.com/googleplay/android-developer/answer/9858738), and a
   personal tip is not one. The site now detects the app (`?source=twa` or the
   `android-app://com.nhako.tools` referrer, kept for the session) and hides
   every Buy Me a Coffee link and the "or buy me a coffee" clause. Verified:
   3 visible on the website, 0 in app mode, sentence still reads cleanly.
7. **Native-feel motion works on real Android touch input** (emulator,
   `adb shell input`): cards sink to 0.97 and spring back; the More sheet
   opens, a slow short drag springs it back, a fast fling dismisses it.
8. **Play access for a new personal account:** "a minimum of 12 testers who
   have been opted in continuously for at least 14 days" before production.
   **Verified** at support.google.com/googleplay/android-developer/answer/14151465.

### Machine setup gotchas found while proving it

- Bubblewrap needs **JDK 17 exactly** (it checks `JAVA_VERSION="17.0"`); this
  machine has 21. A Temurin 17 tarball in any folder is enough; nothing needs
  installing system-wide.
- It needs `build-tools;36.1.0` and `platforms;android-36`. Both were
  installed into `~/Android/Sdk` today with `sdkmanager`.
- It expects `bin/` at the SDK root; a standard SDK has
  `cmdline-tools/latest/bin`. Point it at a folder of symlinks (see the
  header of `scripts/twa-build.mjs`).

## The plan

### Phase 1: keys and domain proof (Kim, about an hour)

| # | Step | Who | Done when |
|---|---|---|---|
| 1.1 | Create the Play developer account (personal) and the app entry "Nhako Tools" | Kim | App exists in Play Console |
| 1.2 | Create the **upload keystore** once: `keytool -genkeypair -v -keystore nhako-upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000` | Kim | Keystore + both passwords in a password manager, **never in the repo** |
| 1.3 | Build: `TWA_JDK=… TWA_SDK=… TWA_KEYSTORE=… TWA_ALIAS=upload TWA_STOREPASS=… TWA_KEYPASS=… node scripts/twa-build.mjs` (after `npm i --no-save @bubblewrap/core@1.25.0`) | Kim | `android-build/nhako-1.0.0.apk` (sideload) and `android-build/nhako-1.0.0.aab` (for Play), both signed with the upload key |
| 1.4 | Upload the `.aab` to an internal test track, opt in to **Play App Signing** | Kim | Play Console > App integrity shows the app signing key |
| 1.5 | Put `public/.well-known/assetlinks.json` in the repo with **both** SHA-256 fingerprints: the upload key (`keytool -list -v -keystore …`) and the Play app signing key (from App integrity) | Claude, with Kim's fingerprints | `curl https://tools.nhako.com/.well-known/assetlinks.json` returns 200, `application/json`, no redirect |
| 1.6 | `vercel.json`: header `Content-Type: application/json` for `/.well-known/assetlinks.json` | Claude | same curl shows the header |

Template for 1.5 (fingerprints are placeholders on purpose):

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.nhako.tools",
    "sha256_cert_fingerprints": ["<UPLOAD KEY SHA-256>", "<PLAY APP SIGNING KEY SHA-256>"]
  }
}]
```

### Phase 2: app behaviour (code, mostly done)

| # | Item | Status |
|---|---|---|
| 2.1 | Detect the app, keep it for the session | **Done and verified today** (`data-app="android"` on `<html>`) |
| 2.2 | Hide Buy Me a Coffee in the app | **Done and verified today** |
| 2.3 | Motion: press feedback on every touchable, push/pop/tab page transitions, sheet drag-to-dismiss, springs, FLIP reordering, iOS switches | **Done and verified today** (see "Motion" below) |
| 2.4 | Back: Android's system Back and predictive back walk the page history; the page's own pop transition plays | Verified in Chromium; on a real phone see "Not verified" |
| 2.5 | Hide the install prompt inside the app (it is already an app) | Already done: InstallPrompt.astro returns early in `display-mode: standalone`, and app.css hides the More-sheet row |
| 2.6 | Share target: "Share to Nhako" from Gallery or Files straight into a tool | Not started. Add `share_target` to the manifest + a `/share` page that routes by MIME type; Bubblewrap reads it from the manifest on the next build |
| 2.7 | File handlers: open a PDF from Files with Nhako | Not started; same mechanism (`file_handlers`) |

### Phase 3: test (half a day)

1. Emulator (`emulator -avd Medium_Phone_API_35`), then **one real Android
   phone**: install the APK signed with the upload key, open it, confirm no
   URL bar (assetlinks live), run one tool per engine: Merge PDF (pdf-lib),
   Compress video (WebCodecs), Extract audio (ffmpeg.wasm), OCR (tesseract),
   Remove background (onnx).
2. Kill the app mid-job, reopen: it starts at `/?source=twa` cleanly.
3. Dark mode, font scaling at 130%, landscape, a 360 px wide phone.
4. Airplane mode: the service worker's shell loads and says what needs a
   connection.

### Phase 4: Play Store

1. Listing: title "Nhako Tools", short description from the manifest, 8 phone
   screenshots (`npm run screenshots` already makes phone captures), the
   feature graphic from `docs/brand/banner.png` resized to 1024x500.
2. Data safety: no data collected by the app; the site's cookieless Vercel
   analytics and the optional feedback form must be declared as the privacy
   page describes them.
3. Closed test with **12 testers for 14 continuous days** (the students who
   left feedback are the natural pool), then apply for production.
4. Content rating questionnaire: utility app, no user-generated content shared
   publicly.

### Phase 5: updates

- Web changes need **no new APK**: they reach the app with the next Vercel
  deploy.
- A new APK is only needed for manifest-level changes (name, icons, colours,
  shortcuts, share target) or a new Play target API level (next one due
  around August 2027). Bump `TWA_VERSION` and `TWA_VERSION_CODE`, rebuild,
  upload the `.aab`.

## Motion: what "smooth like Apple apps" means here, and how it was checked

| Moment | What happens | Verified how |
|---|---|---|
| Any touch on a link, button, card, tab, chip | Sinks (0.86 to 0.985 by size) after 50 ms, springs back with a 2.8% overshoot; a touch that becomes a scroll never sinks | Computed `scale` sampled every 15 ms (Chromium) and real `adb` touch on Android |
| Going deeper (list to tool) | Push: new page slides in from the right, old drifts 30% left and dims, header and tab bar stay put | `pagereveal` types + running keyframes read back; 45 screencast frames |
| Going back | Pop: the reverse | same |
| Switching tabs | Quick dip, tab icon lands with a spring | same |
| More sheet | UIKit sheet curve; grabber; drag down, flick to dismiss | real Android swipe via `adb` |
| Search | Drops in, results stagger 30 ms, fades out | animation names and delays read back |
| Tool panels, previews, staged files | Rise into place; reorders glide (FLIP) | `getAnimations()` on each |
| Preview pages | Slide from the side paged to; horizontal swipe turns the page | swipe with a real pointer drag |
| Switches | iOS switch, thumb on a spring | thumb `translate` sampled: 0 to 18.2 to 18 px |
| Drop zone | Lifts to meet a dragged file | computed `scale` 1.015 |
| iPhone home-screen app | Swipe from the left edge to go back | synthetic touch: slow drag springs back, fling goes back |
| Reduced motion | All of the above off | `prefers-reduced-motion` rules and script guards |

## Risks

- **Play review may still query the coffee link** if a reviewer opens the
  site in a browser; the app itself never shows it.
- **Chrome is required.** On the rare phone without Chrome (or with it
  disabled) the TWA falls back to another browser's Custom Tab; tools that
  need cross-origin isolation may then fall back to slower paths.
- **Keystore loss** means a new package id and losing every install. Play App
  Signing limits this to the upload key, which Play can reset.

## Not verified

- A real Android phone (only the emulator, Android 15, Chrome 124).
- Play Console flows themselves (account creation, review, the closed test).
- Predictive back animation on Android 14+ together with the page's own pop
  transition (possible double animation on some Chrome versions).
- Whether Play review accepts a TWA whose web version links to Buy Me a Coffee.
