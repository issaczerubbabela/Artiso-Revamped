import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Polyfills global indexedDB with a pure-JS implementation so
    // src/local/* (real IndexedDB-backed persistence) is genuinely
    // unit-testable under Node instead of only via a browser E2E test.
    setupFiles: ['./vitest.setup.ts'],
  },
});
