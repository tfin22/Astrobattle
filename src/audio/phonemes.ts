/**
 * Phoneme table for VORG's formant synthesiser. Data only (no audio), so
 * the game logic can time lines without touching WebAudio.
 *
 * Symbols are ARPAbet-style. In a line, phonemes are separated by spaces;
 * a digit suffix 0..3 sets the pitch level (like the 4 inflection levels of
 * 1981 speech chips; default 1). Pauses: '|' word gap, ',' short, '.' long.
 *
 * Formants (Hz) are textbook averages for an adult voice; durations are a
 * little long and even, which is what makes it sound like a machine.
 */
export type PhonemeKind = 'vowel' | 'diph' | 'liquid' | 'nasal' | 'fric' | 'vfric' | 'stop' | 'vstop' | 'aff' | 'asp' | 'pause';

export interface Phoneme {
  kind: PhonemeKind;
  /** Duration in ms. */
  ms: number;
  /** Formant targets F1, F2, F3. A diphthong glides from f to f2. */
  f: [number, number, number];
  f2?: [number, number, number];
  /** Voicing amplitude 0..1 and frication amplitude 0..1. */
  av: number;
  af: number;
  /** Frication noise band centre and width (Hz). */
  fc?: number;
  fb?: number;
  /** Mouth openness 0..2 for VORG's face. */
  mouth: number;
}

const V = (ms: number, f1: number, f2: number, f3: number, mouth = 2): Phoneme => ({ kind: 'vowel', ms, f: [f1, f2, f3], av: 1, af: 0, mouth });
const D = (ms: number, a: [number, number, number], b: [number, number, number]): Phoneme => ({ kind: 'diph', ms, f: a, f2: b, av: 1, af: 0, mouth: 2 });

export const PHONEMES: Record<string, Phoneme> = {
  // Vowels
  IY: V(120, 280, 2250, 2900, 1),
  IH: V(100, 400, 1920, 2560, 1),
  EH: V(110, 550, 1770, 2490),
  AE: V(130, 690, 1660, 2490),
  AA: V(140, 710, 1100, 2540),
  AO: V(140, 590, 880, 2540),
  UH: V(100, 450, 1030, 2380, 1),
  UW: V(130, 310, 870, 2250, 1),
  AH: V(100, 620, 1220, 2550),
  ER: V(130, 470, 1380, 1650, 1),
  // Diphthongs
  EY: D(170, [530, 1840, 2480], [300, 2200, 2900]),
  AY: D(190, [720, 1150, 2500], [320, 2150, 2850]),
  OY: D(200, [560, 860, 2500], [330, 2050, 2800]),
  AW: D(190, [720, 1200, 2500], [340, 900, 2300]),
  OW: D(170, [560, 950, 2450], [330, 860, 2300]),
  // Liquids and glides
  L: { kind: 'liquid', ms: 75, f: [360, 1050, 2800], av: 0.75, af: 0, mouth: 1 },
  R: { kind: 'liquid', ms: 80, f: [420, 1150, 1450], av: 0.75, af: 0, mouth: 1 },
  W: { kind: 'liquid', ms: 70, f: [300, 650, 2200], av: 0.7, af: 0, mouth: 1 },
  Y: { kind: 'liquid', ms: 65, f: [280, 2150, 2950], av: 0.7, af: 0, mouth: 1 },
  // Nasals
  M: { kind: 'nasal', ms: 85, f: [270, 1100, 2150], av: 0.5, af: 0, mouth: 0 },
  N: { kind: 'nasal', ms: 80, f: [270, 1600, 2600], av: 0.5, af: 0, mouth: 1 },
  NG: { kind: 'nasal', ms: 85, f: [270, 2000, 2700], av: 0.5, af: 0, mouth: 1 },
  // Fricatives
  S: { kind: 'fric', ms: 120, f: [400, 1700, 2600], av: 0, af: 0.75, fc: 5200, fb: 2600, mouth: 1 },
  SH: { kind: 'fric', ms: 120, f: [400, 1800, 2500], av: 0, af: 0.8, fc: 2900, fb: 1800, mouth: 1 },
  F: { kind: 'fric', ms: 100, f: [400, 1300, 2400], av: 0, af: 0.35, fc: 4500, fb: 4000, mouth: 0 },
  TH: { kind: 'fric', ms: 95, f: [400, 1500, 2600], av: 0, af: 0.3, fc: 4200, fb: 3500, mouth: 1 },
  HH: { kind: 'asp', ms: 70, f: [500, 1500, 2500], av: 0, af: 0.45, mouth: 1 },
  Z: { kind: 'vfric', ms: 100, f: [300, 1700, 2600], av: 0.45, af: 0.5, fc: 5000, fb: 2600, mouth: 1 },
  ZH: { kind: 'vfric', ms: 100, f: [300, 1800, 2500], av: 0.45, af: 0.55, fc: 2800, fb: 1800, mouth: 1 },
  V: { kind: 'vfric', ms: 80, f: [300, 1200, 2300], av: 0.5, af: 0.25, fc: 4000, fb: 4000, mouth: 0 },
  DH: { kind: 'vfric', ms: 60, f: [300, 1450, 2500], av: 0.55, af: 0.2, fc: 4000, fb: 3500, mouth: 1 },
  // Stops: closure silence then a burst into the next sound
  P: { kind: 'stop', ms: 90, f: [400, 900, 2300], av: 0, af: 0.6, fc: 1200, fb: 2000, mouth: 0 },
  T: { kind: 'stop', ms: 85, f: [400, 1800, 2600], av: 0, af: 0.7, fc: 4200, fb: 3000, mouth: 1 },
  K: { kind: 'stop', ms: 95, f: [400, 1900, 2500], av: 0, af: 0.7, fc: 2200, fb: 1500, mouth: 1 },
  B: { kind: 'vstop', ms: 70, f: [300, 900, 2200], av: 0.3, af: 0.35, fc: 1200, fb: 2000, mouth: 0 },
  D: { kind: 'vstop', ms: 65, f: [300, 1700, 2600], av: 0.3, af: 0.4, fc: 3800, fb: 3000, mouth: 1 },
  G: { kind: 'vstop', ms: 75, f: [300, 1900, 2400], av: 0.3, af: 0.4, fc: 2200, fb: 1500, mouth: 1 },
  CH: { kind: 'aff', ms: 130, f: [400, 1800, 2500], av: 0, af: 0.8, fc: 3000, fb: 2000, mouth: 1 },
  JH: { kind: 'aff', ms: 120, f: [300, 1800, 2500], av: 0.35, af: 0.65, fc: 3000, fb: 2000, mouth: 1 },
  // Pauses
  '|': { kind: 'pause', ms: 25, f: [500, 1500, 2500], av: 0, af: 0, mouth: 0 },
  ',': { kind: 'pause', ms: 150, f: [500, 1500, 2500], av: 0, af: 0, mouth: 0 },
  '.': { kind: 'pause', ms: 280, f: [500, 1500, 2500], av: 0, af: 0, mouth: 0 },
};

export interface PhonemeToken {
  sym: string;
  /** Pitch level 0..3. */
  pitch: number;
  ph: Phoneme;
}

/** Parse "W EH1 L K AH M ." into tokens. Throws on unknown symbols. */
export function parsePhonemes(str: string): PhonemeToken[] {
  const out: PhonemeToken[] = [];
  for (const raw of str.trim().split(/\s+/)) {
    if (!raw) continue;
    const m = /^([A-Z]+|[|,.])([0-3])?$/.exec(raw);
    if (!m) throw new Error(`bad phoneme token "${raw}"`);
    const ph = PHONEMES[m[1]];
    if (!ph) throw new Error(`unknown phoneme "${m[1]}"`);
    out.push({ sym: m[1], pitch: m[2] === undefined ? 1 : Number(m[2]), ph });
  }
  return out;
}

/** Spoken duration in ms (the synthesiser renders exactly this long). */
export function phonemesMs(tokens: PhonemeToken[]): number {
  let ms = 0;
  for (const t of tokens) ms += t.ph.ms;
  return ms + 120; // tail for the last sound to ring out
}

/** Mouth openness (0..2) per 1/60 s frame, for VORG's face. */
export function mouthTrack(tokens: PhonemeToken[]): Uint8Array {
  const frames = Math.ceil((phonemesMs(tokens) / 1000) * 60);
  const out = new Uint8Array(frames);
  let t = 0;
  for (const tok of tokens) {
    const f0 = Math.floor((t / 1000) * 60);
    t += tok.ph.ms;
    const f1 = Math.floor((t / 1000) * 60);
    for (let f = f0; f < f1 && f < frames; f++) out[f] = tok.ph.mouth;
  }
  return out;
}
