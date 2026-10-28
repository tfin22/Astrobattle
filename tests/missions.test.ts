import { describe, expect, it } from 'vitest';
import { newGame, run, idle } from './helpers';
import { TUNING } from '../src/tuning';
import { SCORING } from '../src/content/scoring';
import type { LaserAttack } from '../src/game/missions/laserAttack';
import type { Swarm } from '../src/game/missions/swarm';
import { Bot } from '../src/game/ai';

describe('Laser Attack', () => {
  it('every laser charges for at least the minimum, at every rank', () => {
    for (let level = 0; level < 12; level++) {
      const g = newGame({ mission: 1, level, seed: 10 + level });
      g.invincible = true;
      run(g, 1500, idle);
      const m = g.mission as LaserAttack;
      expect(m.chargeLog.length, `level ${level}`).toBeGreaterThan(0);
      for (const c of m.chargeLog) expect(c).toBeGreaterThanOrEqual(TUNING.minLaserCharge);
    }
  });

  it('a carrier always charges (visibly, holding still) before it fires', () => {
    const g = newGame({ mission: 1, seed: 4 });
    g.invincible = true;
    const seen = new Map<number, string>();
    let fired = 0;
    for (let i = 0; i < 2000; i++) {
      g.step(idle);
      for (const c of g.enemies.filter((e) => e.type === 'carrier')) {
        const prev = seen.get(c.id);
        if (c.state === 'firing' && prev !== 'firing') {
          fired++;
          expect(prev).toBe('charging');
        }
        seen.set(c.id, c.state);
      }
    }
    expect(fired).toBeGreaterThan(2);
  });

  it('the beam kills a player standing under it', () => {
    const g = newGame({ mission: 1, seed: 4 });
    const m = g.mission as LaserAttack;
    const c = m.carriers(g)[0];
    g.setState(c, 'firing');
    g.player.x = c.x;
    run(g, 2);
    expect(g.player.alive).toBe(false);
  });

  it('shooting a carrier mid-charge cancels the laser and pays a bonus', () => {
    const g = newGame({ mission: 1, seed: 4 });
    const m = g.mission as LaserAttack;
    const c = m.carriers(g)[0];
    g.setState(c, 'charging');
    c.p0 = 80;
    const before = g.score;
    m.onHit(g, c);
    expect(c.state).toBe('drift');
    expect(g.score - before).toBeGreaterThanOrEqual(SCORING.carrierCancelBonus);
    expect(c.hp).toBeLessThan(3);
  });

  it('can be cleared', () => {
    const g = newGame({ mission: 1, seed: 2, single: true });
    g.invincible = true;
    const bot = new Bot();
    for (let i = 0; i < 20000 && g.phase !== 'done'; i++) g.step(bot.think(g));
    expect(g.phase).toBe('done');
  });
});

describe('Swarm', () => {
  it('is a cloud, not a grid: home offsets are irregular', () => {
    const g = newGame({ mission: 2 });
    const xs = new Set(g.enemies.map((e) => Math.round(e.hx)));
    const ys = new Set(g.enemies.map((e) => Math.round(e.hy)));
    // A grid would share a handful of columns and rows.
    expect(xs.size).toBeGreaterThan(g.enemies.length * 0.7);
    expect(ys.size).toBeGreaterThan(g.enemies.length * 0.5);
  });

  it('breathes: members move even while in formation', () => {
    const g = newGame({ mission: 2 });
    const e = g.enemies[0];
    const x0 = e.x;
    run(g, 30);
    expect(e.x).not.toBe(x0);
  });

  it('kamikazes aim for where the player will be, not where they are', () => {
    const g = newGame({ mission: 2, seed: 9 });
    const m = g.mission as Swarm;
    const k = g.enemies.find((e) => e.type === 'kamikaze') ?? g.enemies[0];
    k.type = 'kamikaze';
    g.setState(k, 'leaving');
    k.t = 23;
    k.p0 = 1;
    g.player.x = 60;
    g.player.vx = TUNING.shipSpeed; // moving right
    (m as unknown as { updateMember(g: unknown, e: unknown): void }).updateMember(g, k);
    expect(k.state).toBe('attacking');
    const frames = (g.player.y - k.y) / k.vy;
    const landX = k.x + k.vx * frames;
    expect(landX).toBeGreaterThan(g.player.x + 10);
  });

  it('can be cleared', () => {
    const g = newGame({ mission: 2, seed: 2, single: true });
    g.invincible = true;
    const bot = new Bot();
    for (let i = 0; i < 20000 && g.phase !== 'done'; i++) g.step(bot.think(g));
    expect(g.phase).toBe('done');
  });
});
