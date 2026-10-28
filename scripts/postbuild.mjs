// After `vite build`: check the single-file size limit.
import fs from 'node:fs';

const html = fs.readFileSync('dist/index.html');
const kb = (html.length / 1024).toFixed(1);
const LIMIT = 2 * 1024 * 1024;
if (html.length > LIMIT) {
  console.error(`dist/index.html is ${kb} KB, over the 2 MB limit`);
  process.exit(1);
}
console.log(`dist/index.html: ${kb} KB (limit 2048 KB)`);
