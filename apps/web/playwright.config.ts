import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // pwa.spec.ts needs the production export and its service worker; it runs
  // under playwright.pwa.config.ts instead.
  testIgnore: ['**/pwa.spec.ts'],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  // Defaults to a Compact-breakpoint viewport since that's the primary
  // target (see docs/architecture/06-workspace-interaction.md); tests
  // covering Wide-specific chrome (e.g. golden-path-wide.spec.ts) override
  // this with their own test.use({ viewport }).
  use: { baseURL: 'http://localhost:3000', viewport: { width: 390, height: 844 } },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' }, testIgnore: ['**/ipad.spec.ts', '**/pwa.spec.ts'] },
    // Safari's engine: iPad and iPhone run WebKit whatever the browser, and
    // its WebGL, OffscreenCanvas and IndexedDB differ from Chromium's. The
    // iPad spec emulates touch at both iPad breakpoints; the rest of the
    // suite runs here too, at its own viewports.
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
