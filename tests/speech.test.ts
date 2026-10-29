import { describe, expect, it } from 'vitest';
import { TRIGGERS, allLines } from '../src/content/speech';
import { parsePhonemes, phonemesMs } from '../src/audio/phonemes';
import { synthesize, SPEECH_RATE } from '../src/audio/speech';
import { Vorg, resolveLine } from '../src/game/vorg';
import { Rng } from '../src/core/rng';
import { RANKS } from '../src/content/ranks';
import { TUNING } from '../src/tuning';
import { newGame, run } from './helpers';

describe('VORG lines', () => {
  it('has about sixty original, short lines with valid phonemes', () => {
    const lines = allLines();
    expect(lines.length).toBeGreaterThanOrEqual(60);
    for (const { line } of lines) {
      const words = line.text.replace('{RANK}', 'CADET').split(/\s+/).length;
      expect(words, line.text).toBeGreaterThanOrEqual(1);
      expect(words, line.text).toBeLessThanOrEqual(7);
      expect(() => parsePhonemes(line.ph.replace('{RANK}', 'K AH D EH1 T')), line.text).not.toThrow();
      expect(line.text).not.toMatch(/TODO|XXX|PLACEHOLDER/);
    }
    for (const r of RANKS) expect(() => parsePhonemes(r.say)).not.toThrow();
  });

  it('every spec trigger has lines', () => {
    for (const t of ['attract', 'coin', 'gameStart', 'missionShieldWall', 'playerDeath', 'nearMiss', 'missStreak', 'extraLife', 'promotion', 'flagshipDestroyed', 'highScore', 'gameOver']) {
      expect(TRIGGERS[t]?.lines.length, t).toBeGreaterThan(0);
    }
  });

  it('uses the rank in rank lines', () => {
    const r = resolveLine('promotion', 0, 1);
    expect(r.text).toBe('A NEW ENSIGN. HOW BRIEF.');
    expect(r.ph).toContain(RANKS[1].say);
  });
});

describe('the speech synthesiser', () => {
  it('renders every line, deterministically, for exactly its scripted length', () => {
    for (const { trigger, index } of allLines().slice(0, 20)) {
      const l = resolveLine(trigger, index, 0);
      const a = synthesize(l.ph);
      const expected = Math.ceil((phonemesMs(parsePhonemes(l.ph)) / 1000) * SPEECH_RATE);
      expect(a.length).toBe(expected);
      let peak = 0;
      for (const v of a) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak).toBeGreaterThan(0.3);
      expect(peak).toBeLessThanOrEqual(1);
      const b = synthesize(l.ph);
      expect(b).toEqual(a);
    }
  });
});

describe('which line plays', () => {
  it('"last ship" lines play when you are down to your last ship, not on the final death', () => {
    const g = newGame({ startShips: 2 });
    g.killPlayer();
    expect(g.lives).toBe(1);
    const said = g.vorg.log.map((l) => l.trigger);
    const pending = (g.vorg as unknown as { pending: { trigger: string } | null }).pending?.trigger;
    expect([...said, pending]).toContain('lastShip');
    const h = newGame({ startShips: 1 });
    h.killPlayer();
    const said2 = [...h.vorg.log.map((l) => l.trigger), (h.vorg as unknown as { pending: { trigger: string } | null }).pending?.trigger];
    expect(said2).not.toContain('lastShip');
  });
});

describe('when VORG speaks', () => {
  function vorg() {
    const said: string[] = [];
    const v = new Vorg(new Rng(5), (t) => said.push(t));
    return { v, said };
  }

  it('every trigger fires a line when VORG is free', () => {
    for (const t of Object.keys(TRIGGERS)) {
      const { v, said } = vorg();
      expect(v.trigger(t, 1000, 0), t).toBe(true);
      expect(said).toEqual([t]);
    }
  });

  it('never speaks two lines at once; high-priority lines wait their turn', () => {
    const { v, said } = vorg();
    v.trigger('playerDeath', 0, 0);
    const end = v.current!.frames;
    expect(v.trigger('gameOver', 5, 0)).toBe(false);
    expect(said.length).toBe(1);
    for (let f = 1; f <= end + 2; f++) v.update(f);
    expect(said).toEqual(['playerDeath', 'gameOver']);
    // The second started only after the first ended.
    expect(v.log[1].start).toBeGreaterThanOrEqual(v.log[0].start + v.log[0].frames);
  });

  it('low-priority taunts are dropped while busy and during the cooldown', () => {
    const { v, said } = vorg();
    v.trigger('gameStart', 0, 0);
    const end = v.current!.frames;
    expect(v.trigger('nearMiss', 3, 0)).toBe(false);
    for (let f = 1; f <= end; f++) v.update(f);
    expect(v.current).toBeNull();
    expect(v.trigger('nearMiss', end + 10, 0)).toBe(false); // still cooling down
    for (let f = end; f <= end + TUNING.speechCooldown + 1; f++) v.update(f);
    expect(v.trigger('nearMiss', end + TUNING.speechCooldown + 2, 0)).toBe(true);
    expect(said).toEqual(['gameStart', 'nearMiss']);
  });

  it('in a real game, lines never overlap', () => {
    const g = newGame({ seed: 3, skipCard: false });
    for (let i = 0; i < 3000; i++) {
      g.step({ mx: (i >> 6) & 1 ? 1 : -1, my: 0, fire: i % 5 === 0, fireHeld: false });
      if (g.phase === 'done') break;
    }
    const log = g.vorg.log;
    expect(log.length).toBeGreaterThan(1);
    for (let i = 1; i < log.length; i++) expect(log[i].start).toBeGreaterThanOrEqual(log[i - 1].start + log[i - 1].frames);
    run(g, 1);
  });
});
