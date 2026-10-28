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

import type { SpaceWarp } from '../src/game/missions/spaceWarp';
import type { Flagship } from '../src/game/missions/flagship';

describe('Space Warp', () => {
  it('enemies emerge from the vortex small and grow as they spiral out', () => {
    const g = newGame({ mission: 3, seed: 3 });
    g.invincible = true;
    const m = g.mission as SpaceWarp;
    run(g, 60);
    const e = g.enemies.find((x) => x.type === 'warpling')!;
    expect(e).toBeTruthy();
    expect(Math.hypot(e.x - m.cx, e.y - m.cy)).toBeLessThan(20);
    expect(e.stage).toBe(0);
    let maxStage = 0;
    for (let i = 0; i < 400 && e.alive; i++) {
      g.step(idle);
      maxStage = Math.max(maxStage, e.stage);
    }
    expect(maxStage).toBe(2);
  });

  it('escaped enemies go back into the vortex; clearing needs them all', () => {
    const g = newGame({ mission: 3, seed: 3 });
    g.invincible = true;
    const m = g.mission as SpaceWarp;
    const total = m.total;
    run(g, 3000);
    // Nobody shot anything: everyone who escaped is queued again.
    expect(m.toSpawn + m.warplings(g).length).toBe(total);
    expect(g.phase).toBe('play');
  });

  it('pays most for small, early hits', () => {
    const g = newGame({ mission: 3, seed: 3 });
    run(g, 60);
    const e = g.enemies.find((x) => x.type === 'warpling')!;
    const before = g.score;
    g.killEnemy(e);
    expect(g.score - before).toBe(200);
  });

  it('can be cleared', () => {
    const g = newGame({ mission: 3, seed: 2, single: true });
    g.invincible = true;
    const bot = new Bot();
    for (let i = 0; i < 30000 && g.phase !== 'done'; i++) g.step(bot.think(g));
    expect(g.phase).toBe('done');
  });
});

describe('Flagship', () => {
  function flagGame(over = {}) {
    const g = newGame({ mission: 4, seed: 5, ...over });
    const m = g.mission as Flagship;
    return { g, m };
  }
  /** Fire one shot straight up at screen x, by teleporting the ship under it. */
  function shootAt(g: ReturnType<typeof newGame>, m: Flagship, dx: number) {
    g.player.x = m.x + dx;
    g.step({ mx: 0, my: 0, fire: true, fireHeld: true });
    // Freeze the ship so the column under it stays put.
    const dir = m.dir;
    m.dir = 0;
    for (let i = 0; i < 80 && g.shot.alive; i++) g.step(idle);
    m.dir = dir;
  }

  it('shots chip hull blocks one at a time', () => {
    const { g, m } = flagGame();
    g.invincible = true;
    const before = m.remaining();
    shootAt(g, m, 0);
    expect(m.remaining()).toBeLessThan(before);
    expect(m.reactorHit).toBe(false);
  });

  it('the reactor is only reachable through a channel, and destroying it promotes you', () => {
    const { g, m } = flagGame();
    g.invincible = true;
    for (let i = 0; i < m.rows; i++) {
      shootAt(g, m, 0);
      expect(m.reactorHit).toBe(false);
    }
    shootAt(g, m, 0);
    expect(m.reactorHit).toBe(true);
    expect(g.phase).toBe('boom');
    const level = g.level;
    run(g, 400);
    expect(g.level).toBe(level + 1);
    run(g, 400);
    expect(g.missionIndex).toBe(0); // the next loop starts
  });

  it('hull damage persists after you lose a ship', () => {
    const { g, m } = flagGame();
    shootAt(g, m, 0);
    shootAt(g, m, 0);
    const left = m.remaining();
    g.killPlayer();
    run(g, 200);
    expect(g.phase).toBe('play');
    expect(g.mission).toBe(m);
    expect(m.remaining()).toBe(left);
  });

  it('can be cleared by the bot', () => {
    const g = newGame({ mission: 4, seed: 2, single: true });
    g.invincible = true;
    const bot = new Bot();
    for (let i = 0; i < 30000 && g.phase !== 'done'; i++) g.step(bot.think(g));
    expect(g.phase).toBe('done');
    expect(g.level).toBe(1);
  });
});
