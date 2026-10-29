// Render every VORG line to 16 kHz WAV files (for listening / recogniser checks).
// Usage: npx vite-node scripts/speech-wavs.ts <outdir>
import fs from 'node:fs';
import path from 'node:path';
import { allLines } from '../src/content/speech';
import { resolveLine } from '../src/game/vorg';
import { synthesize, SPEECH_RATE } from '../src/audio/speech';

const outDir = process.argv[2] ?? 'shots/speech';
fs.mkdirSync(outDir, { recursive: true });
function wav(samples: Float32Array, rate: number): Buffer {
  const out = 16000;
  const n = Math.floor((samples.length * out) / rate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(out, 24); buf.writeUInt32LE(out * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const x = (i * rate) / out;
    const i0 = Math.floor(x);
    const v = samples[i0] + ((samples[i0 + 1] ?? 0) - samples[i0]) * (x - i0);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 30000))), 44 + i * 2);
  }
  return buf;
}
const index: { file: string; text: string }[] = [];
for (const l of allLines()) {
  const r = resolveLine(l.trigger, l.index, 1);
  const file = `${l.trigger}-${l.index}.wav`;
  fs.writeFileSync(path.join(outDir, file), wav(synthesize(r.ph), SPEECH_RATE));
  index.push({ file, text: r.text });
}
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 1));
console.log(`wrote ${index.length} lines to ${outDir}`);
