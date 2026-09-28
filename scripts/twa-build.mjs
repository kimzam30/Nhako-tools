/**
 * Build the Android app (a Trusted Web Activity) from the live web manifest,
 * without Bubblewrap's interactive prompts. See plan.md, Phase 1.
 *
 * Proven on 2026-09-29: this exact flow built a 1.0 MB APK (targetSdk 36) in
 * 84 s, which installed and ran full screen on the Android 15 emulator with
 * crossOriginIsolated === true.
 *
 * Needs, none of them in package.json on purpose (only the release machine
 * builds the app):
 *   npm i --no-save @bubblewrap/core@1.25.0
 *   JDK 17 exactly (Bubblewrap checks JAVA_VERSION="17.0"): TWA_JDK=/path/to/jdk-17
 *   Android SDK with build-tools 36.1.0 and platforms;android-36: TWA_SDK=/path
 *     Bubblewrap expects `bin/` at the SDK root. A standard SDK keeps it in
 *     cmdline-tools/latest/bin, so point TWA_SDK at a folder of symlinks:
 *     build-tools, platforms, platform-tools, licenses, cmdline-tools, and
 *     bin -> cmdline-tools/latest/bin.
 *   The UPLOAD keystore, which only Kim holds:
 *     TWA_KEYSTORE=/path/upload.keystore TWA_ALIAS=upload TWA_STOREPASS=... TWA_KEYPASS=...
 *   Without TWA_KEYSTORE, a throwaway test key is made next to the output,
 *   and the result is only good for the emulator.
 *
 *   node scripts/twa-build.mjs [outDir]   (default: ./android-build, gitignored)
 */
import { TwaManifest, TwaGenerator, Config, JdkHelper, AndroidSdkTools, GradleWrapper, KeyTool, JarSigner, ConsoleLog } from '@bubblewrap/core';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const env = process.env;
const OUT = resolve(process.argv[2] ?? 'android-build');
const JDK = env.TWA_JDK;
const SDK = env.TWA_SDK;
if (!JDK || !SDK) {
  console.error('Set TWA_JDK (a JDK 17) and TWA_SDK (see the header of this file).');
  process.exit(1);
}
const test = !env.TWA_KEYSTORE;
const KEYSTORE = env.TWA_KEYSTORE ?? join(OUT, 'test-only.keystore');
const ALIAS = env.TWA_ALIAS ?? 'test';
const STOREPASS = env.TWA_STOREPASS ?? 'test-only-not-for-release';
const KEYPASS = env.TWA_KEYPASS ?? STOREPASS;
const VERSION = env.TWA_VERSION ?? '1.0.0';
const CODE = Number(env.TWA_VERSION_CODE ?? 1);

const log = new ConsoleLog('twa');
const config = new Config(JDK, SDK);
const jdk = new JdkHelper(process, config);
const sdk = await AndroidSdkTools.create(process, config, jdk, log);

const manifest = await TwaManifest.fromWebManifest('https://tools.nhako.com/manifest.webmanifest');
manifest.packageId = 'com.nhako.tools';
manifest.launcherName = 'Nhako';
// How the site knows it is inside the app (BaseLayout: data-app="android").
manifest.startUrl = '/?source=twa';
manifest.signingKey = { path: KEYSTORE, alias: ALIAS };
manifest.appVersionName = VERSION;
manifest.appVersionCode = CODE;
manifest.fallbackType = 'customtabs';
manifest.enableNotifications = false;

const project = join(OUT, 'project');
mkdirSync(project, { recursive: true });
await new TwaGenerator().createTwaProject(project, manifest, log);
await manifest.saveToFile(join(project, 'twa-manifest.json'));

if (test && !existsSync(KEYSTORE)) {
  await new KeyTool(jdk, log).createSigningKey({
    path: KEYSTORE, alias: ALIAS, password: STOREPASS, keypassword: KEYPASS,
    fullName: 'Test Only', organizationalUnit: 'Test', organization: 'Test', country: 'MY',
  });
}

const gradle = new GradleWrapper(process, sdk, project);
await gradle.assembleRelease();
await gradle.bundleRelease(); // the .aab is what Play takes
const unsigned = join(project, 'app/build/outputs/apk/release/app-release-unsigned.apk');
const aligned = join(OUT, 'aligned.apk');
const apk = join(OUT, test ? 'nhako-TEST-ONLY.apk' : `nhako-${VERSION}.apk`);
await sdk.zipalign(unsigned, aligned);
await sdk.apksigner(KEYSTORE, STOREPASS, ALIAS, KEYPASS, aligned, apk);
// Play only accepts a bundle signed with the upload key, as Bubblewrap's own
// CLI does it: jarsigner over the .aab.
const aab = join(OUT, test ? 'nhako-TEST-ONLY.aab' : `nhako-${VERSION}.aab`);
await new JarSigner(jdk).sign({ path: KEYSTORE, alias: ALIAS }, STOREPASS, KEYPASS, join(project, 'app/build/outputs/bundle/release/app-release.aab'), aab);
console.log(`APK: ${apk}`);
console.log(`AAB for Play: ${aab}`);
if (test) console.log('Signed with a throwaway test key: for the emulator only, never for Play.');
