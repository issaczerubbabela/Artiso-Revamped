import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static export so this build can be bundled directly into the Capacitor
  // Android shell in Phase 4 without a hosted-URL dependency (see
  // docs/architecture/10-mobile-android-shell.md).
  output: 'export',
  images: { unoptimized: true },
  // Icons are imported by name from the package root; this keeps only the ones used.
  experimental: { optimizePackageImports: ['@phosphor-icons/react'] },
  transpilePackages: [
    '@artiso/ui',
    '@artiso/core-engine',
    '@artiso/renderer',
    '@artiso/api-client',
    '@artiso/shared-types',
  ],
};

export default nextConfig;
