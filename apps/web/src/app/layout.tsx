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
};

// The app is always dark until the light theme has been verified
// (docs/design.md §2): native controls, scrollbars and the browser/status bar
// follow that rather than the OS preference.
export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0A0A0B',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
