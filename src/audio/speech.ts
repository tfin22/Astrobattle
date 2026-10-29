import { parsePhonemes, phonemesMs, PHONEMES, type Phoneme, type PhonemeToken } from './phonemes';

/**
 * VORG's voice: a small formant synthesiser of our own, built to sound like
 * 1981 speech hardware. A buzzy glottal pulse train (a robotic monotone,
 * with four pitch levels for emphasis) and a noise source feed three
 * cascaded formant resonators and a frication band-pass. Parameters jump
 * between phoneme targets with short, crude transitions, updated every
 * 5 ms. The result is sample-held and quantised for that crackly grain.
 *
 * Pure function of the phoneme string: same input, same samples.
 */
export const SPEECH_RATE = 22050;
const FRAME = 110; // samples per parameter update (~5 ms)
const BASE_F0 = 85;
const PITCH = [0.84, 1.0, 1.17, 1.34];
const BW = [80, 100, 150];
/** Frication level. Natural S/SH sit ~8-12 dB under the vowels. */
const FRIC_GAIN = 0.4;
/** Stop-consonant bursts relative to their table level. */
const BURST_GAIN = 0.55;

interface Params {
  f1: number; f2: number; f3: number;
  av: number;   // voicing amplitude through the formants
  asp: number;  // aspiration noise through the formants
  af: number;   // frication noise through the band-pass
  fc: number; fb: number;
  f0: number;
}

class Resonator {
  private y1 = 0;
  private y2 = 0;
  private a = 0;
  private b = 0;
  private c = 0;
  set(f: number, bw: number): void {
    const T = 1 / SPEECH_RATE;
    this.c = -Math.exp(-2 * Math.PI * bw * T);
    this.b = 2 * Math.exp(-Math.PI * bw * T) * Math.cos(2 * Math.PI * f * T);
    this.a = 1 - this.b - this.c;
  }
  run(x: number): number {
    const y = this.a * x + this.b * this.y1 + this.c * this.y2;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Phoneme targets at a time `k` (0..1) through it, with crude transitions. */
function targetsAt(tokens: PhonemeToken[], i: number, k: number): Params {
  const tok = tokens[i];
  const ph = tok.ph;
  const prev = findVoiced(tokens, i, -1);
  const next = findVoiced(tokens, i, 1);
  let f: [number, number, number] = [...ph.f];
  if (ph.kind === 'diph' && ph.f2) {
    const kk = Math.min(1, Math.max(0, (k - 0.25) / 0.6));
    f = [0, 1, 2].map((j) => ph.f[j] + (ph.f2![j] - ph.f[j]) * kk) as [number, number, number];
  }
  // Transitions: the first ~30% glides in from the previous sound.
  if (prev && k < 0.35 && ph.kind !== 'pause') {
    const pe = prev.f2 ?? prev.f;
    // Start from halfway between: the previous sound already glided toward us.
    const src = [0, 1, 2].map((j) => pe[j] + (f[j] - pe[j]) * 0.5);
    const kk = k / 0.35;
    f = [0, 1, 2].map((j) => src[j] + (f[j] - src[j]) * kk) as [number, number, number];
  }
  if (next && k > 0.75 && ph.kind !== 'pause' && ph.kind !== 'stop' && ph.kind !== 'vstop' && ph.kind !== 'aff') {
    const kk = ((k - 0.75) / 0.25) * 0.5;
    f = [0, 1, 2].map((j) => f[j] + (next.f[j] - f[j]) * kk) as [number, number, number];
  }
  const f0 = BASE_F0 * PITCH[tok.pitch] * (1 - 0.04 * (i / Math.max(1, tokens.length)));
  const p: Params = { f1: f[0], f2: f[1], f3: f[2], av: ph.av, asp: 0, af: 0, fc: ph.fc ?? 3000, fb: ph.fb ?? 2000, f0 };
  switch (ph.kind) {
    case 'pause':
      p.av = 0;
      break;
    case 'fric':
      p.af = ph.af;
      break;
    case 'vfric':
      p.af = ph.af;
      p.av = ph.av;
      break;
    case 'asp': {
      // H takes on the shape of the vowel that follows.
      const n = next ?? ph;
      p.f1 = n.f[0];
      p.f2 = n.f[1];
      p.f3 = n.f[2];
      p.asp = ph.af;
      p.av = 0;
      break;
    }
    case 'stop':
    case 'vstop':
    case 'aff': {
      const closure = ph.kind === 'aff' ? 0.35 : 0.55;
      const burstEnd = closure + (ph.kind === 'aff' ? 0.6 : 0.15);
      if (k < closure) {
        p.av = ph.kind === 'stop' ? 0 : ph.av * 0.35; // voice bar
        p.f1 = 200;
      } else if (k < burstEnd) {
        p.af = ph.kind === 'aff' ? ph.af : ph.af * BURST_GAIN;
        p.av = ph.kind === 'stop' ? 0 : ph.av;
      } else {
        // Release into the next sound: aspiration for voiceless stops.
        const n = next ?? ph;
        p.f1 = n.f[0];
        p.f2 = n.f[1];
        p.f3 = n.f[2];
        if (ph.kind === 'stop') p.asp = 0.35;
        else p.av = 0.7;
      }
      break;
    }
    default:
      break;
  }
  return p;
}

function findVoiced(tokens: PhonemeToken[], i: number, dir: number): Phoneme | null {
  const j = i + dir;
  if (j < 0 || j >= tokens.length) return null;
  const ph = tokens[j].ph;
  if (ph.kind === 'pause') return null;
  return ph;
}

/** Synthesise a phoneme string to mono samples at SPEECH_RATE. */
export function synthesize(phonemes: string, opts: { raw?: boolean } = {}): Float32Array {
  const tokens = parsePhonemes(phonemes);
  const total = Math.ceil((phonemesMs(tokens) / 1000) * SPEECH_RATE);
  const out = new Float32Array(total);
  const r1 = new Resonator();
  const r2 = new Resonator();
  const r3 = new Resonator();
  const rf = new Resonator();
  const r4 = new Resonator();
  const r5 = new Resonator();
  r4.set(3400, 250);
  r5.set(3900, 300);
  // Boundaries in samples.
  const bounds: number[] = [];
  let t = 0;
  for (const tok of tokens) {
    bounds.push(Math.round((t / 1000) * SPEECH_RATE));
    t += tok.ph.ms;
  }
  bounds.push(Math.round((t / 1000) * SPEECH_RATE));

  let seed = 0x1234567;
  const noise = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return (seed >>> 8) / 8388608 - 1;
  };
  let phase = 0;
  let cur: Params = { f1: 500, f2: 1500, f3: 2500, av: 0, asp: 0, af: 0, fc: 3000, fb: 2000, f0: BASE_F0 };
  let prevGlottal = 0;
  let idx = 0;
  for (let s0 = 0; s0 < total; s0 += FRAME) {
    while (idx < tokens.length - 1 && s0 >= bounds[idx + 1]) idx++;
    let target: Params;
    if (s0 >= bounds[tokens.length]) {
      target = { ...cur, av: 0, asp: 0, af: 0 };
    } else {
      const k = (s0 - bounds[idx]) / Math.max(1, bounds[idx + 1] - bounds[idx]);
      target = targetsAt(tokens, idx, k);
    }
    // Amplitudes ramp over one frame so sounds start and stop without clicks;
    // formants jump (that's the crude, mechanical part).
    const from = cur;
    cur = target;
    // Nasals: damp the upper formants for a murmur.
    const nasal = tokens[idx]?.ph.kind === 'nasal' && s0 < bounds[tokens.length];
    r1.set(cur.f1, BW[0]);
    r2.set(cur.f2, nasal ? 500 : BW[1]);
    r3.set(cur.f3, nasal ? 700 : BW[2]);
    rf.set(cur.fc, cur.fb);
    const end = Math.min(total, s0 + FRAME);
    for (let s = s0; s < end; s++) {
      const m = (s - s0) / FRAME;
      const av = from.av + (cur.av - from.av) * m;
      const asp = from.asp + (cur.asp - from.asp) * m;
      const af = from.af + (cur.af - from.af) * m;
      const f0 = from.f0 + (cur.f0 - from.f0) * m;
      phase += f0 / SPEECH_RATE;
      if (phase >= 1) phase -= 1;
      // Glottal pulse (open, close, closed); its derivative is a bright buzz.
      let g: number;
      if (phase < 0.4) g = 0.5 * (1 - Math.cos((Math.PI * phase) / 0.4));
      else if (phase < 0.56) g = Math.cos((Math.PI * (phase - 0.4)) / 0.32);
      else g = 0;
      const buzz = (g - prevGlottal) * 18;
      prevGlottal = g;
      const n = noise();
      const src = buzz * av + n * asp * 0.6;
      const voiced = r5.run(r4.run(r3.run(r2.run(r1.run(src)))));
      const fric = rf.run(n) * af * FRIC_GAIN;
      out[s] = voiced + fric;
    }
  }
  return opts.raw ? out : lofi(out);
}

/** Two-pole low-pass (RBJ biquad), in place. */
function lowpass(x: Float32Array, fc: number, q = 0.707): void {
  const w = (2 * Math.PI * fc) / SPEECH_RATE;
  const al = Math.sin(w) / (2 * q);
  const cw = Math.cos(w);
  const a0 = 1 + al;
  const b0 = (1 - cw) / 2 / a0;
  const b1 = (1 - cw) / a0;
  const a1 = (-2 * cw) / a0;
  const a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = b0 * x[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = y;
    x[i] = y;
  }
}

/**
 * The 1981 speaker: remove DC, even out the loudness gently (no clipping),
 * band-limit like the old chip's output filter, sample-hold to ~11 kHz for
 * the grain, smooth the steps, then quantise to 8 bits.
 */
function lofi(x: Float32Array): Float32Array {
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < x.length; i++) {
    const y = x[i] - prevIn + 0.995 * prevOut;
    prevIn = x[i];
    prevOut = y;
    x[i] = y;
  }
  // Leveller: a slow envelope follower and a mild gain curve (about 1.6:1),
  // so emphasised syllables and loud consonants don't jump out.
  const env = new Float32Array(x.length);
  const att = Math.exp(-1 / (0.008 * SPEECH_RATE));
  const rel = Math.exp(-1 / (0.09 * SPEECH_RATE));
  let e = 0;
  let maxEnv = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    e = a > e ? att * e + (1 - att) * a : rel * e + (1 - rel) * a;
    env[i] = e;
    if (e > maxEnv) maxEnv = e;
  }
  const ref = maxEnv * 0.45;
  const floor = maxEnv * 0.05;
  for (let i = 0; i < x.length; i++) {
    const v = Math.max(env[i], floor);
    x[i] *= Math.min(1.8, Math.max(0.55, Math.pow(ref / v, 0.38)));
  }
  lowpass(x, 4800);
  let held = 0;
  for (let i = 0; i < x.length; i++) {
    if ((i & 1) === 0) held = x[i];
    x[i] = held;
  }
  lowpass(x, 5200);
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  const k = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < x.length; i++) x[i] = Math.round(x[i] * k * 128) / 128;
  const fade = Math.min(200, x.length);
  for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade;
  return x;
}

export { PHONEMES };
