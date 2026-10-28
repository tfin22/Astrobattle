import type { Rng } from '../core/rng';
import { TUNING } from '../tuning';
import { TRIGGERS } from '../content/speech';
import { RANKS, rankIndex } from '../content/ranks';
import { parsePhonemes, phonemesMs } from '../audio/phonemes';

/** A line ready to speak: {RANK} filled in, duration known. */
export interface SpokenLine {
  trigger: string;
  index: number;
  text: string;
  ph: string;
  frames: number;
  start: number;
}

export function resolveLine(trigger: string, index: number, level: number): Omit<SpokenLine, 'start'> {
  const line = TRIGGERS[trigger].lines[index];
  const rank = RANKS[rankIndex(level)];
  const text = line.text.replace('{RANK}', rank.short);
  const ph = line.ph.replace('{RANK}', rank.say);
  const frames = Math.ceil((phonemesMs(parsePhonemes(ph)) / 1000) * 60);
  return { trigger, index, text, ph, frames };
}

/**
 * Decides when VORG speaks. Rules:
 *  - never more than one line at once;
 *  - high-priority triggers wait for the current line, then speak
 *    (only the most recent waiting one is kept);
 *  - low-priority triggers are dropped while speaking or during the
 *    cooldown after a line, so VORG doesn't nag;
 *  - the same line isn't repeated while others are unused recently.
 * Deterministic: it uses its own seeded RNG and the game's frame clock.
 */
export class Vorg {
  current: SpokenLine | null = null;
  private quietUntil = 0;
  private pending: { trigger: string; level: number } | null = null;
  private recent: string[] = [];
  /** Every line spoken (tests). */
  log: SpokenLine[] = [];

  constructor(private rng: Rng, private emit: (trigger: string, line: SpokenLine) => void) {}

  trigger(trigger: string, now: number, level: number): boolean {
    const t = TRIGGERS[trigger];
    if (!t) return false;
    if (this.current && now < this.current.start + this.current.frames) {
      if (t.priority === 'high') this.pending = { trigger, level };
      return false;
    }
    if (t.priority === 'low' && now < this.quietUntil) return false;
    this.speak(trigger, now, level);
    return true;
  }

  /** Force a specific line (debug menu). */
  sayLine(trigger: string, index: number, now: number, level: number): void {
    this.current = null;
    this.pending = null;
    this.start(resolveLine(trigger, index, level), now);
  }

  update(now: number): void {
    if (this.current && now >= this.current.start + this.current.frames) {
      this.quietUntil = now + TUNING.speechCooldown;
      this.current = null;
    }
    if (!this.current && this.pending) {
      const p = this.pending;
      this.pending = null;
      this.speak(p.trigger, now, p.level);
    }
  }

  get speaking(): boolean {
    return this.current !== null;
  }

  private speak(trigger: string, now: number, level: number): void {
    const lines = TRIGGERS[trigger].lines;
    let idx = this.rng.int(lines.length);
    for (let tries = 0; tries < lines.length && this.recent.includes(`${trigger}:${idx}`); tries++) {
      idx = (idx + 1) % lines.length;
    }
    this.recent.push(`${trigger}:${idx}`);
    if (this.recent.length > 12) this.recent.shift();
    this.start(resolveLine(trigger, idx, level), now);
  }

  private start(l: Omit<SpokenLine, 'start'>, now: number): void {
    const line: SpokenLine = { ...l, start: now };
    this.current = line;
    this.log.push(line);
    this.emit(line.trigger, line);
  }
}
