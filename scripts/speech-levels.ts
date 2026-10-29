// Diagnostics for VORG's voice: loudness of each kind of sound relative to
// the vowels, and how much high-frequency hiss the output carries.
// Usage: npx vite-node scripts/speech-levels.ts
import { allLines } from '../src/content/speech';
import { resolveLine } from '../src/game/vorg';
import { synthesize, SPEECH_RATE } from '../src/audio/speech';
import { parsePhonemes } from '../src/audio/phonemes';

const db = (x: number) => (x > 0 ? 10 * Math.log10(x) : -120);
function measure(raw: boolean) {
  const kinds: Record<string, { e: number; n: number; peakDb: number[] }> = {};
  let hf = 0, all = 0, gapE = 0, gapN = 0;
  for (const { trigger, index } of allLines()) {
    const l = resolveLine(trigger, index, 0);
    const toks = parsePhonemes(l.ph);
    const y = synthesize(l.ph, { raw });
    let peak = 0;
    for (const v of y) peak = Math.max(peak, Math.abs(v));
    const norm = raw ? 1 / (peak || 1) : 1;
    let t = 0;
    for (const tok of toks) {
      const s0 = Math.round((t / 1000) * SPEECH_RATE);
      t += tok.ph.ms;
      const s1 = Math.round((t / 1000) * SPEECH_RATE);
      let e = 0;
      // 10 ms windows: track the loudest window per phoneme (jumps)
      let maxWin = 0;
      for (let w = s0; w < s1; w += 220) {
        let we = 0, c = 0;
        for (let i = w; i < Math.min(s1, w + 220); i++) { we += (y[i] * norm) ** 2; c++; }
        maxWin = Math.max(maxWin, we / Math.max(1, c));
      }
      for (let i = s0; i < s1; i++) e += (y[i] * norm) ** 2;
      const k = tok.ph.kind === 'pause' ? 'pause' : tok.ph.kind;
      kinds[k] ??= { e: 0, n: 0, peakDb: [] };
      kinds[k].e += e;
      kinds[k].n += s1 - s0;
      kinds[k].peakDb.push(db(maxWin));
      if (k === 'pause') { gapE += e; gapN += s1 - s0; }
    }
    // Hiss proxy: energy of the first difference vs the signal.
    for (let i = 1; i < y.length; i++) { hf += (y[i] - y[i - 1]) ** 2; all += y[i] ** 2; }
  }
  const vowel = kinds.vowel.e / kinds.vowel.n;
  const rows = Object.entries(kinds).map(([k, v]) => {
    const sorted = v.peakDb.sort((a, b) => a - b);
    return `${k.padEnd(7)} avg ${(db(v.e / v.n) - db(vowel)).toFixed(1).padStart(6)} dB   loudest 10ms ${(sorted[sorted.length - 1] - db(vowel)).toFixed(1).padStart(6)} dB`;
  });
  console.log(`${raw ? 'RAW (before lo-fi)' : 'OUTPUT'}  (relative to average vowel level)\n  ${rows.join('\n  ')}\n  hiss index (HF/all energy): ${(hf / all).toFixed(3)}`);
}
measure(true);
measure(false);
