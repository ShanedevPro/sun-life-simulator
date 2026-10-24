import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 60000, expect: { timeout: 12000 }, workers: 1,
  reporter: [['list'], ['json', { outputFile: 'docs/qa/e2e-results.json' }]],
  use: { baseURL: process.env.PLAYTEST_URL ?? 'http://127.0.0.1:5173', channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
