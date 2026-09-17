import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static export so this build can be bundled directly into the Capacitor
  // Android shell in Phase 4 without a hosted-URL dependency (see
  // docs/architecture/10-mobile-android-shell.md).
  output: 'export',
  images: { unoptimized: true },
  transpilePackages: [
    '@drawing-grid/ui',
    '@drawing-grid/core-engine',
    '@drawing-grid/renderer',
    '@drawing-grid/api-client',
    '@drawing-grid/shared-types',
  ],
};

export default nextConfig;
