import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4321', trace: 'on-first-retry' },
  // WebKit is the closest stand-in for Safari available on Linux. It found
  // two bugs Chromium could not: engine-specific JSON error text, and input
  // lost before hydration. It needs `npx playwright install webkit` (plus
  // libavif16 on Ubuntu), so it is opt-in via `npm run test:e2e:all`.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
