import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
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
});
