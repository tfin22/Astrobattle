// After `vite build`: check the single-file size limit and write the
// optional PWA companions (manifest, service worker, icons). The game itself
// is complete in dist/index.html; these only matter when it's served over
// https (add to home screen, offline cache).
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { VORG_FACE } from '../src/content/sprites';
import { MASTER, col } from '../src/palette';

const html = fs.readFileSync('dist/index.html');
const LIMIT = 2 * 1024 * 1024;
const kb = (html.length / 1024).toFixed(1);
if (html.length > LIMIT) {
  console.error(`dist/index.html is ${kb} KB, over the 2 MB limit`);
  process.exit(1);
}

// --- Icons: VORG's face on black, drawn from the sprite data. -------------
function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size: number): Buffer {
  const rows = VORG_FACE.frames[0];
  const w = rows[0].length;
  const h = rows.length;
  const scale = Math.floor((size * 0.78) / Math.max(w, h));
  const ox = Math.floor((size - w * scale) / 2);
  const oy = Math.floor((size - h * scale) / 2);
  const pens: Record<string, number> = { '1': col('GREY', 5), '2': col('VIOLET', 3), '3': col('YELLOW', 7), '4': col('ORANGE', 6), '5': col('MAGENTA', 5) };
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x - ox) / scale);
      const sy = Math.floor((y - oy) / scale);
      let rgb = [0, 0, 0];
      if (sx >= 0 && sy >= 0 && sx < w && sy < h && rows[sy][sx] !== '.') rgb = MASTER[pens[rows[sy][sx]] ?? 0];
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = rgb[0];
      raw[i + 1] = rgb[1];
      raw[i + 2] = rgb[2];
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
fs.writeFileSync('dist/icon-192.png', png(192));
fs.writeFileSync('dist/icon-512.png', png(512));

const manifest = {
  name: 'VORG26',
  short_name: 'VORG26',
  description: 'A lost arcade treasure, rediscovered. VORG is waiting.',
  start_url: './',
  scope: './',
  display: 'fullscreen',
  orientation: 'portrait',
  background_color: '#000000',
  theme_color: '#000000',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
};
fs.writeFileSync('dist/manifest.webmanifest', JSON.stringify(manifest, null, 2));

// Service worker: cache everything up front, serve from cache (offline),
// refresh the cache in the background when online.
const version = crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
const sw = `// VORG26 offline cache (generated).
const CACHE = 'qc-${version}';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});
`;
fs.writeFileSync('dist/sw.js', sw);
console.log(`dist/index.html: ${kb} KB (limit 2048 KB) + PWA files (manifest, sw.js, icons)`);
