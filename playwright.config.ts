import { defineConfig, devices } from '@playwright/test';

// E2E_PORT lets the suite run beside a dev server already on 4321. Without
// it, reuseExistingServer would quietly test `astro dev` instead of the
// production build.
const PORT = Number(process.env.E2E_PORT ?? 4321);

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
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `npm run build && PORT=${PORT} npm run preview`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
