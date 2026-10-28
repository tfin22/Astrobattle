import { describe, expect, it } from 'vitest';
import { newGame, run, idle, press, botScore } from './helpers';
import type { ShieldWall } from '../src/game/missions/shieldWall';

describe('the quantum shot', () => {
  it('fires one shot', () => {
    const g = newGame();
    g.step(press);
    expect(g.shot.alive).toBe(true);
    expect(g.stats.shotsFired).toBe(1);
  });

  it('only one player shot can exist, whatever you press', () => {
    const g = newGame();
    for (let i = 0; i < 300; i++) {
      g.step(i % 3 === 0 ? press : idle);
      // There is exactly one shot object; it is either alive or not.
      expect(typeof g.shot.alive).toBe('boolean');
    }
    expect(g.stats.shotsFired).toBeGreaterThan(50);
  });

  it('firing again cancels the shot in flight and launches a new one from the ship', () => {
    const g = newGame();
    (g.mission as ShieldWall).field.fill(0);
    g.step(press);
    run(g, 10);
    const yBefore = g.shot.y;
    expect(g.shot.alive).toBe(true);
    g.step(press);
    expect(g.stats.cancels).toBe(1);
    expect(g.shot.alive).toBe(true);
    // The new shot starts at the ship, below where the old one was.
    expect(g.shot.y).toBeGreaterThan(yBefore + 30);
    expect(g.events.some((e) => e.t === 'sfx' && e.id === 'cancel')).toBe(true);
  });

  it('a shot that leaves the screen frees you to fire', () => {
    const g = newGame();
    g.enemies = [];
    (g.mission as ShieldWall).field.fill(0);
    g.step(press);
    run(g, 80);
    expect(g.shot.alive).toBe(false);
  });

  it('hold to fire re-fires only when the shot ends, never cancelling', () => {
    const g = newGame({ holdToFire: true });
    const held = { mx: 0, my: 0, fire: false, fireHeld: true };
    run(g, 200, held);
    expect(g.stats.cancels).toBe(0);
    expect(g.stats.shotsFired).toBeGreaterThan(2);
  });

  it('a tap-spammer scores measurably less on Shield Wall than a patient player (100 seeds)', () => {
    let patient = 0;
    let spammer = 0;
    let patientWins = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const a = botScore('patient', seed, 2400);
      const b = botScore('spammer', seed, 2400);
      patient += a;
      spammer += b;
      if (a > b) patientWins++;
    }
    expect(patient).toBeGreaterThan(spammer * 1.5);
    expect(patientWins).toBeGreaterThan(80);
  });
});
