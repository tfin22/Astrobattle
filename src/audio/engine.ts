import { CHIP_RATE, renderSfx, type SfxDef } from './chip';
import { LOOPS, PULSE, SFX } from '../content/sfx';
import type { SfxId } from '../game/types';
import { SPEECH_RATE, synthesize } from './speech';
import { allLines } from '../content/speech';

type Ctx = AudioContext;

/**
 * Plays the chip's effects and VORG's voice through WebAudio. Everything is
 * synthesised here at startup (effects) or on first use (speech lines,
 * then cached). Nothing is sampled or loaded.
 */
export class AudioEngine {
  enabled = true;
  volume = 0.8;
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private playing = new Map<string, AudioBufferSourceNode>();
  private speech: AudioBufferSourceNode | null = null;
  private speechCache = new Map<string, AudioBuffer>();
  private loops = new Map<string, AudioBufferSourceNode>();

  /** Must be called from a user gesture (browsers block audio before one). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    // Gentle low-pass: a cabinet speaker, not a hi-fi.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    this.master.connect(lp);
    lp.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.55;
    this.sfxBus.connect(this.master);
    this.voiceBus = ctx.createGain();
    this.voiceBus.gain.value = 0.9;
    this.voiceBus.connect(this.master);
    this.applyGain();
    // Render every effect now; it takes a few milliseconds.
    for (const [id, def] of Object.entries(SFX)) this.buffers.set(id, this.toBuffer(renderSfx(def)));
    PULSE.forEach((def, i) => this.buffers.set(`pulse${i}`, this.toBuffer(renderSfx(def))));
    for (const [id, def] of Object.entries(LOOPS)) this.buffers.set(`loop:${id}`, this.toBuffer(renderSfx(def)));
    if (ctx.state === 'suspended') void ctx.resume();
    this.prewarm();
  }

  /** Synthesise VORG's lines a few at a time while nothing else is happening. */
  private prewarm(): void {
    const queue = allLines().map((l) => l.line.ph).filter((ph) => !ph.includes('{RANK}'));
    const work = () => {
      const t0 = performance.now();
      while (queue.length && performance.now() - t0 < 4) {
        const ph = queue.shift()!;
        if (!this.speechCache.has(ph)) this.speechCache.set(ph, this.toBuffer(synthesize(ph), SPEECH_RATE));
      }
      if (queue.length) setTimeout(work, 50);
    };
    setTimeout(work, 200);
  }

  private toBuffer(samples: Float32Array, rate = CHIP_RATE): AudioBuffer {
    const b = this.ctx!.createBuffer(1, Math.max(1, samples.length), rate);
    b.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    return b;
  }

  apply(enabled: boolean, volume: number): void {
    this.enabled = enabled;
    this.volume = volume;
    this.applyGain();
    if (!enabled) {
      this.stopSpeech();
      for (const id of [...this.loops.keys()]) this.setLoop(id as 'warp', false);
    }
  }

  private applyGain(): void {
    if (this.master) this.master.gain.value = this.enabled ? this.volume : 0;
  }

  private play(key: string, bus: GainNode | null, exclusive = false): AudioBufferSourceNode | null {
    if (!this.ctx || !this.enabled || !bus) return null;
    const buf = this.buffers.get(key);
    if (!buf) return null;
    if (exclusive) {
      const prev = this.playing.get(key);
      try {
        prev?.stop();
      } catch {
        /* already stopped */
      }
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(bus);
    src.start();
    if (exclusive) this.playing.set(key, src);
    return src;
  }

  sfx(id: SfxId, dur?: number): void {
    if (!this.ctx) return;
    let key: string = id;
    if (id === 'laserCharge' && dur) {
      // Match the laser's real charge time so the tone peaks as it fires.
      key = `laserCharge:${dur}`;
      if (!this.buffers.has(key)) {
        const base = SFX.laserCharge;
        const def: SfxDef = { ...base, voices: base.voices.map((v) => ({ ...v, len: dur })) };
        this.buffers.set(key, this.toBuffer(renderSfx(def)));
      }
    }
    const exclusive = id === 'shot' || id === 'fizz' || id === 'dart' || id === 'enemyShot' || id === 'chip' || id === 'laserCharge';
    this.play(key, this.sfxBus, exclusive);
  }

  stop(id: SfxId): void {
    for (const [key, src] of this.playing) {
      if (key === id || key.startsWith(id + ':')) {
        try {
          src.stop();
        } catch {
          /* ignore */
        }
        this.playing.delete(key);
      }
    }
  }

  pulse(beat: number): void {
    this.play(`pulse${beat & 1}`, this.sfxBus);
  }

  setLoop(id: 'warp', on: boolean): void {
    const cur = this.loops.get(id);
    if (on && !cur && this.ctx && this.enabled) {
      const buf = this.buffers.get(`loop:${id}`);
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = 0.7;
      src.connect(g);
      g.connect(this.sfxBus!);
      src.start();
      this.loops.set(id, src);
    } else if (!on && cur) {
      try {
        cur.stop();
      } catch {
        /* ignore */
      }
      this.loops.delete(id);
    }
  }

  /** Speak a phoneme string in VORG's voice. One line at a time. */
  say(ph: string): void {
    if (!this.ctx || !this.enabled) return;
    let buf = this.speechCache.get(ph);
    if (!buf) {
      buf = this.toBuffer(synthesize(ph), SPEECH_RATE);
      this.speechCache.set(ph, buf);
    }
    this.stopSpeech();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.voiceBus!);
    src.start();
    this.speech = src;
  }

  stopSpeech(): void {
    try {
      this.speech?.stop();
    } catch {
      /* ignore */
    }
    this.speech = null;
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }
}
