// Renders public/icon.svg into the PNG sizes the manifest and iOS need.
// Run by hand after changing the icon (the PNGs are committed):
//   pnpm --filter web exec node scripts/render-icons.mjs
// Uses Playwright's Chromium, which the e2e suite already depends on.
import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = await readFile(join(root, 'icon.svg'), 'utf8');

// [file, size]. The maskable and Apple icons are full-bleed squares already
// (the artwork sits in the safe zone), so they share the same source.
const outputs = [
  ['icons/icon-192.png', 192],
  ['icons/icon-512.png', 512],
  ['icons/icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
];

await mkdir(join(root, 'icons'), { recursive: true });
const browser = await chromium.launch();
try {
  for (const [file, size] of outputs) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
    );
    await page.screenshot({ path: join(root, file), omitBackground: false });
    await page.close();
    console.log(`wrote ${file}`);
  }
} finally {
  await browser.close();
}
