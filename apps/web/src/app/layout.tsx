import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import './globals.css';
import './chrome.css';

// Self-hosted variable, latin-subset fonts (docs/design.md §3) so the offline
// build never depends on a font CDN. Only Manrope is preloaded: it is the one
// every screen needs immediately. The --font-* variables are consumed by
// packages/ui/src/tokens/tokens.css.
const manrope = localFont({
  src: '../fonts/manrope-latin-wght-normal.woff2',
  variable: '--font-manrope',
  weight: '200 800',
  display: 'swap',
});
const spaceGrotesk = localFont({
  src: '../fonts/space-grotesk-latin-wght-normal.woff2',
  variable: '--font-space-grotesk',
  weight: '300 700',
  display: 'swap',
  preload: false,
});
const jetbrainsMono = localFont({
  src: '../fonts/jetbrains-mono-latin-wght-normal.woff2',
  variable: '--font-jetbrains-mono',
  weight: '100 800',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'Artiso',
  description: 'A reference preparation companion for artists.',
  // Installable web app (phone, tablet, laptop): see public/manifest.webmanifest
  // and scripts/generate-sw.mjs.
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  // iOS/iPadOS home-screen launch: full screen with no Safari bars; the status
  // bar draws over the dark canvas, and the chrome keeps clear of it via the
  // safe-area insets in chrome.css.
  appleWebApp: { capable: true, title: 'Artiso', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

// The app is always dark until the light theme has been verified
// (docs/design.md §2): native controls, scrollbars and the browser/status bar
// follow that rather than the OS preference.
export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0A0A0B',
  // Fill the whole screen (rounded iPad corners, home indicator, notch); the
  // canvas is full-bleed by design and chrome.css pads the floating panels by
  // env(safe-area-inset-*).
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
