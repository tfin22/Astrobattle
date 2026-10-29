/**
 * Playtest: "the robot voice has a bit of hissiness... it jumps in volume".
 * Measured: S/SH louder than the vowels, a hard soft-clip, lots of HF grit.
 */
import { describe, expect, it } from 'vitest';
import { allLines } from '../src/content/speech';
import { resolveLine } from '../src/game/vorg';
import { synthesize, SPEECH_RATE } from '../src/audio/speech';
import { parsePhonemes } from '../src/audio/phonemes';

const db = (x: number) => 10 * Math.log10(Math.max(x, 1e-12));

function levels() {
  const sums: Record<string, { e: number; n: number }> = {};
  let hf = 0;
  let all = 0;
  for (const { trigger, index } of allLines()) {
    const l = resolveLine(trigger, index, 0);
    const y = synthesize(l.ph);
    let t = 0;
    for (const tok of parsePhonemes(l.ph)) {
      const s0 = Math.round((t / 1000) * SPEECH_RATE);
      t += tok.ph.ms;
      const s1 = Math.round((t / 1000) * SPEECH_RATE);
      const k = tok.ph.kind;
      sums[k] ??= { e: 0, n: 0 };
      for (let i = s0; i < s1; i++) sums[k].e += y[i] * y[i];
      sums[k].n += s1 - s0;
    }
    for (let i = 1; i < y.length; i++) {
      hf += (y[i] - y[i - 1]) ** 2;
      all += y[i] * y[i];
    }
  }
  const rel = (k: string) => db(sums[k].e / sums[k].n) - db(sums.vowel.e / sums.vowel.n);
  return { rel, hiss: hf / all };
}

describe("playtest: VORG's voice is clean, not hissy", () => {
  const { rel, hiss } = levels();

  it('hissy consonants (S, SH, F...) sit well under the vowels, like real speech', () => {
    expect(rel('fric')).toBeLessThan(-5);
    expect(rel('aff')).toBeLessThan(-3);
    expect(rel('vfric')).toBeLessThan(-2);
  });

  it('consonant bursts do not jump out above the vowels', () => {
    expect(rel('stop')).toBeLessThan(-6);
    expect(rel('vstop')).toBeLessThan(-4);
  });

  it('little high-frequency hiss in the output', () => {
    expect(hiss).toBeLessThan(0.1);
  });
});
