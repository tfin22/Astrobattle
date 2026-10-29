/**
 * Playtest: "the drumbeat is too fast when there is only one baddie left".
 */
import { describe, expect, it } from 'vitest';
import { newGame, idle } from './helpers';
import { TUNING } from '../src/tuning';

function beatsPerSecond(mission: number, lone: boolean): number {
  const g = newGame({ seed: 3, mission });
  g.invincible = true;
  if (mission === 3) (g.mission as unknown as { toSpawn: number }).toSpawn = lone ? 1 : 20;
  if (lone) g.enemies.filter((e) => e.type !== 'saucer').slice(1).forEach((e) => (e.alive = false));
  let beats = 0;
  const frames = 600;
  for (let i = 0; i < frames; i++) {
    g.step(idle);
    beats += g.events.filter((e) => e.t === 'pulse').length;
  }
  return beats / (frames / 60);
}

describe('playtest: the background drumbeat', () => {
  it('never beats faster than the cap, even with one enemy left, in any mission', () => {
    const cap = 60 / TUNING.pulseFast + 0.2;
    for (const m of [0, 1, 2, 3]) expect(beatsPerSecond(m, true), `mission ${m + 1}`).toBeLessThanOrEqual(cap);
  });

  it('the cap is a calm-ish 3 to 4 beats a second', () => {
    expect(60 / TUNING.pulseFast).toBeLessThanOrEqual(4);
  });

  it('still speeds up as the wave thins', () => {
    expect(beatsPerSecond(0, true)).toBeGreaterThan(beatsPerSecond(0, false) * 1.5);
  });
});
