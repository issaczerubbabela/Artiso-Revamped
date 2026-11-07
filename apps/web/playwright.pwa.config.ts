import { defineConfig } from '@playwright/test';

// Installable/offline checks against the real production export -- the
// service worker only exists after `next build` + scripts/generate-sw.mjs, so
// this can't run against `next dev` like the main suite.
//   pnpm --filter web build && pnpm --filter web exec playwright test -c playwright.pwa.config.ts
export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/pwa.spec.ts'],
  webServer: {
    command: 'node scripts/serve-static.mjs',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1194, height: 834 }, browserName: 'chromium' },
});
