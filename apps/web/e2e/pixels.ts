import { deflateSync } from 'node:zlib';
import type { Page } from '@playwright/test';

export type Rgb = [number, number, number];

// A solid-colour PNG, built in memory so a test can hand the app a "photo" of
// a known colour without a binary fixture per colour.
export function solidPng(width: number, height: number, [r, g, b]: Rgb): Buffer {
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// The colour actually on screen around a point: a screenshot of a small square,
// decoded by the browser, taking the per-channel median so a grid line crossing
// the square does not skew it.
export async function screenColour(page: Page, x: number, y: number, radius = 6): Promise<Rgb> {
  const size = radius * 2 + 1;
  const png = await page.screenshot({ clip: { x: x - radius, y: y - radius, width: size, height: size } });
  return page.evaluate(async (b64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${b64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, image.width, image.height);
    const channels: number[][] = [[], [], []];
    for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) channels[c]!.push(data[i + c]!);
    return channels.map((values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!) as [number, number, number];
  }, png.toString('base64'));
}

export function colourDistance(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
