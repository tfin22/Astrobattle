/**
 * QC-1: our own small sound chip, in the spirit of the 1981 board's custom
 * sound section. Three square-wave tone channels, one noise channel (a
 * 15-bit shift register), a global vibrato, 4-bit volumes, and a mixer
 * that quantises the output to 6 bits for a little grit.
 *
 * Effects are programs for this chip (content/sfx.ts): voices that set a
 * channel's frequency and volume, with sweeps, arpeggios and per-tick
 * changes, ticked 60 times a second like a game's sound driver.
 */
export const CHIP_RATE = 22050;
export const TICK = 1 / 60;
const SAMPLES_PER_TICK = CHIP_RATE / 60;

export type Channel = 0 | 1 | 2 | 'n';

export interface Voice {
  ch: Channel;
  /** Start tick and length in ticks. */
  at?: number;
  len: number;
  /** Frequency in Hz (noise: shift-register clock rate) at start and end. */
  f0: number;
  f1?: number;
  /** Volume 0..15 at start and end. */
  v0: number;
  v1?: number;
  /** Sweep shape: 'exp' sounds natural for pitch, 'lin' for volume-like effects. */
  curve?: 'lin' | 'exp';
  /** Arpeggio: semitone offsets cycled every `arpRate` ticks. */
  arp?: number[];
  arpRate?: number;
  /** Duty cycle 0..1 (default 0.5). */
  duty?: number;
}

export interface SfxDef {
  voices: Voice[];
  /** Global vibrato: rate in Hz, depth as a fraction of pitch. */
  vibrato?: { rate: number; depth: number };
  /** Total length in ticks (defaults to the end of the last voice). */
  ticks?: number;
  /** Overall gain 0..1 (default 1). */
  gain?: number;
}

interface ChanState { freq: number; vol: number; duty: number }

/** Render an effect to samples at CHIP_RATE. Pure and deterministic. */
export function renderSfx(def: SfxDef): Float32Array {
  const ticks = def.ticks ?? Math.max(...def.voices.map((v) => (v.at ?? 0) + v.len));
  const n = Math.ceil(ticks * SAMPLES_PER_TICK);
  const out = new Float32Array(n);
  const phase = [0, 0, 0];
  let lfsr = 0x4001;
  let noisePhase = 0;
  let noiseOut = 1;
  let vibPhase = 0;
  const gain = def.gain ?? 1;
  for (let tick = 0; tick < ticks; tick++) {
    // Sound-driver tick: work out each channel's registers.
    const chans: (ChanState | null)[] = [null, null, null, null];
    for (const v of def.voices) {
      const start = v.at ?? 0;
      const local = tick - start;
      if (local < 0 || local >= v.len) continue;
      const k = v.len > 1 ? local / (v.len - 1) : 0;
      const f1 = v.f1 ?? v.f0;
      let f = v.curve === 'lin' ? v.f0 + (f1 - v.f0) * k : v.f0 * Math.pow(f1 / v.f0, k);
      if (v.arp && v.arp.length) {
        const step = v.arp[Math.floor(local / (v.arpRate ?? 2)) % v.arp.length];
        f *= Math.pow(2, step / 12);
      }
      const v1 = v.v1 ?? v.v0;
      const vol = Math.round(v.v0 + (v1 - v.v0) * k);
      const idx = v.ch === 'n' ? 3 : v.ch;
      chans[idx] = { freq: f, vol: Math.max(0, Math.min(15, vol)), duty: v.duty ?? 0.5 };
    }
    const s0 = Math.floor(tick * SAMPLES_PER_TICK);
    const s1 = Math.min(n, Math.floor((tick + 1) * SAMPLES_PER_TICK));
    for (let s = s0; s < s1; s++) {
      let vib = 1;
      if (def.vibrato) {
        vibPhase += def.vibrato.rate / CHIP_RATE;
        // Triangle LFO, like a simple hardware vibrato.
        const tri = 1 - 4 * Math.abs((vibPhase % 1) - 0.5);
        vib = 1 + def.vibrato.depth * tri;
      }
      let mix = 0;
      for (let c = 0; c < 3; c++) {
        const ch = chans[c];
        if (!ch || ch.vol === 0) continue;
        phase[c] += (ch.freq * vib) / CHIP_RATE;
        phase[c] -= Math.floor(phase[c]);
        mix += (phase[c] < ch.duty ? 1 : -1) * (ch.vol / 15);
      }
      const nz = chans[3];
      if (nz && nz.vol > 0) {
        noisePhase += (nz.freq * vib) / CHIP_RATE;
        while (noisePhase >= 1) {
          noisePhase -= 1;
          const bit = (lfsr ^ (lfsr >> 1)) & 1;
          lfsr = (lfsr >> 1) | (bit << 14);
          noiseOut = lfsr & 1 ? 1 : -1;
        }
        mix += noiseOut * (nz.vol / 15);
      }
      // Mixer: scale for 4 channels, then quantise to 6 bits.
      const q = Math.round((mix / 4) * gain * 32) / 32;
      out[s] = q;
    }
  }
  // Tiny fade at the very end so effects never click.
  const fade = Math.min(64, n);
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  return out;
}

/** Note name to frequency, e.g. 'A4' = 440, 'C#5'. */
export function note(name: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const base: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  let semi = base[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
  if (Number.isNaN(semi)) semi = 0;
  return 440 * Math.pow(2, semi / 12);
}

/** A melody on one channel: notes of `len` ticks each ('-' = rest). */
export function melody(ch: Channel, notes: string[], len: number, vol: number, at = 0, decay = 0): Voice[] {
  const out: Voice[] = [];
  notes.forEach((nm, i) => {
    if (nm === '-') return;
    const f = note(nm);
    out.push({ ch, at: at + i * len, len, f0: f, v0: vol, v1: Math.max(0, vol - decay) });
  });
  return out;
}
