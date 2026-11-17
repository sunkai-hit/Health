import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /mvp-local\.spec\.mjs$/,
  timeout: 35_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1, // Tests share a disposable local D1 and use unique synthetic event names.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8787',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run dev:api',
    url: 'http://127.0.0.1:8787/api/v1/health',
    timeout: 100_000,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: 'local-desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
    { name: 'local-mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ]
});
