/**
 * Playtest round 1 findings, each written as a failing test first.
 */
import { describe, expect, it } from 'vitest';
import { newGame, run, idle, press } from './helpers';
import type { ShieldWall } from '../src/game/missions/shieldWall';
import type { Game } from '../src/game/game';

const field = (g: Game) => g.mission as ShieldWall;

describe('playtest 1: the force field switches off while you fire (as in the original)', () => {
  it('firing drops the field, and your shot goes through without eating it', () => {
    const g = newGame({ seed: 21 });
    const before = field(g).fieldPixels();
    g.step(press);
    expect(field(g).fieldUp).toBe(false);
    run(g, 12);
    expect(field(g).fieldPixels()).toBe(before);
    // The shot made it out past the field.
    expect(g.shot.alive ? g.shot.y : 0).toBeLessThan(field(g).fieldTop);
  });

  it('the field comes back on by itself', () => {
    const g = newGame({ seed: 21 });
    g.step(press);
    run(g, 40);
    expect(field(g).fieldUp).toBe(true);
  });

  it('while it is down, bombs go straight through', () => {
    const g = newGame({ seed: 21 });
    g.enemies = g.enemies.slice(0, 1);
    g.enemies[0].y = 30;
    g.player.x = 20;
    const before = field(g).fieldPixels();
    g.dropBomb(102, 236);
    g.step(press); // field down as the bomb reaches it
    run(g, 14);
    expect(field(g).fieldPixels()).toBe(before);
  });

  it('enemy fire still wears it away when it is up', () => {
    const g = newGame({ seed: 21 });
    g.enemies = g.enemies.slice(0, 1);
    g.enemies[0].y = 30;
    g.player.x = 20;
    const before = field(g).fieldPixels();
    g.dropBomb(102, 200);
    run(g, 60, idle);
    expect(field(g).fieldPixels()).toBeLessThan(before);
  });
});

describe('playtest 1: the last few enemies get faster and fire more', () => {
  for (const [mission, name] of [[0, 'Shield Wall'], [1, 'Laser Attack'], [2, 'Swarm'], [3, 'Space Warp']] as const) {
    it(`${name}: survivors speed up as the wave thins`, () => {
      const g = newGame({ seed: 5, mission });
      g.invincible = true;
      run(g, 2);
      const full = { s: g.urgeSpeed ?? 1, f: g.urgeFire ?? 1 };
      // Clear all but one.
      const live = g.enemies.filter((e) => e.alive && e.type !== 'saucer');
      if (mission === 3) (g.mission as unknown as { toSpawn: number }).toSpawn = 0;
      live.slice(1).forEach((e) => (e.alive = false));
      run(g, 2);
      expect(g.urgeSpeed ?? 1).toBeGreaterThan(full.s * 1.4);
      expect(g.urgeFire ?? 1).toBeGreaterThan(full.f * 1.8);
    });
  }

  it('the Flagship is not affected', () => {
    const g = newGame({ seed: 5, mission: 4 });
    run(g, 2);
    expect(g.urgeSpeed ?? 1).toBe(1);
  });

  it('a lone Shield Wall fighter bombs far more often than a full block', () => {
    const bombs = (lone: boolean) => {
      let n = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const g = newGame({ seed });
        g.invincible = true;
        if (lone) g.enemies.slice(1).forEach((e) => (e.alive = false));
        for (let i = 0; i < 600; i++) {
          g.step(idle);
          n += g.events.filter((e) => e.t === 'sfx' && e.id === 'enemyShot').length;
        }
      }
      return n;
    };
    // One fighter, yet it drops a good share of what a whole block does.
    expect(bombs(true)).toBeGreaterThan(bombs(false) * 0.15);
  });
});
