import { defineConfig, devices } from '@playwright/test';

// E2E_PORT lets the suite run beside a dev server already on 4321. Without
// it, reuseExistingServer would quietly test `astro dev` instead of the
// production build.
const PORT = Number(process.env.E2E_PORT ?? 4321);

// Phone and tablet viewports run one spec, and the desktop projects skip it.
const MOBILE = /teleprompter-mobile\.spec\.ts/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'on-first-retry' },
  // WebKit is the closest stand-in for Safari available on Linux. It found
  // two bugs Chromium could not: engine-specific JSON error text, and input
  // lost before hydration. It needs `npx playwright install webkit` (plus
  // libavif16 on Ubuntu), so it is opt-in via `npm run test:e2e:all`.
  projects: [
    // A fake camera and microphone (a test pattern and a beep), so the
    // teleprompter's recording can be tested end to end.
    { name: 'chromium', testIgnore: MOBILE, use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } } },
    { name: 'webkit', testIgnore: MOBILE, use: { ...devices['Desktop Safari'] } },
    // Firefox runs the teleprompter only. It is the third engine a Windows or
    // Mac laptop might use, and it is the one with no speech recognition and
    // (until recently) no Wake Lock, so it exercises those fallbacks for real.
    { name: 'firefox', testMatch: /teleprompter\.spec\.ts/, use: { ...devices['Desktop Firefox'] } },
    // The teleprompter is the one tool people run from a phone or tablet on a
    // stand, so it gets the handset and tablet viewports the desktop projects
    // cannot show: Chromium stands in for Android, WebKit for iOS and iPadOS.
    { name: 'android', testMatch: MOBILE, use: { ...devices['Pixel 7'], launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } } },
    { name: 'ios', testMatch: MOBILE, use: { ...devices['iPhone 14'] } },
    { name: 'ios-landscape', testMatch: MOBILE, use: { ...devices['iPhone 14 landscape'] } },
    { name: 'ipados', testMatch: MOBILE, use: { ...devices['iPad (gen 7)'] } },
    { name: 'ipados-landscape', testMatch: MOBILE, use: { ...devices['iPad (gen 7) landscape'] } },
  ],
  webServer: {
    command: `npm run build && PORT=${PORT} npm run preview`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
