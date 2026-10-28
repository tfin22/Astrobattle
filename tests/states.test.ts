import { describe, expect, it } from 'vitest';
import { newGame, run, idle } from './helpers';
import { TUNING } from '../src/tuning';
import { ENEMY_TYPES } from '../src/content/enemies';
import { PLAYER } from '../src/content/sprites';
import type { Enemy } from '../src/game/types';
import type { ShieldWall } from '../src/game/missions/shieldWall';

describe('hitboxes and collision', () => {
  it('every hitbox is smaller than its sprite; the player is generous', () => {
    for (const t of Object.values(ENEMY_TYPES)) {
      t.sprites.forEach((s, i) => {
        const h = t.hit[Math.min(i, t.hit.length - 1)];
        expect(h.w, t.name).toBeLessThan(s.frames[0][0].length);
        expect(h.h, t.name).toBeLessThanOrEqual(s.frames[0].length);
      });
    }
    expect(TUNING.playerHitW).toBeLessThan(PLAYER.frames[0][0].length * 0.7);
    expect(TUNING.playerHitH).toBeLessThan(PLAYER.frames[0].length * 0.7);
  });

  it('a bomb that clips the wing tip (outside the hitbox) does not kill', () => {
    const g = newGame({ seed: 8 });
    (g.mission as ShieldWall).field.fill(0);
    g.enemies.forEach((e) => (e.y = 30));
    g.bullets = [{ x: g.player.x + 6, y: g.player.y - 8, vx: 0, vy: 1, type: 'bomb', grazed: false, alive: true }];
    run(g, 20);
    expect(g.player.alive).toBe(true);
  });

  it('a bomb through the middle kills', () => {
    const g = newGame({ seed: 8 });
    (g.mission as ShieldWall).field.fill(0);
    g.bullets = [{ x: g.player.x, y: g.player.y - 8, vx: 0, vy: 1, type: 'bomb', grazed: false, alive: true }];
    run(g, 20);
    expect(g.player.alive).toBe(false);
  });

  it('flying into an enemy kills both', () => {
    const g = newGame({ seed: 8 });
    const e = g.enemies[0];
    g.setState(e, 'attacking');
    e.x = g.player.x;
    e.y = g.player.y - 2;
    g.step(idle);
    expect(g.player.alive).toBe(false);
    expect(e.alive).toBe(false);
  });

  it('the shot hits along its whole length (no tunnelling)', () => {
    const g = newGame({ seed: 8 });
    const e = g.enemies[0];
    expect(g.hitsEnemy(e, e.x, e.y + 2, TUNING.shotLength)).toBe(true);
    expect(g.hitsEnemy(e, e.x, e.y + 20, TUNING.shotLength)).toBe(false);
    expect(g.hitsEnemy(e, e.x + 20, e.y, TUNING.shotLength)).toBe(false);
  });
});

describe('enemy state machines', () => {
  function trace(g: ReturnType<typeof newGame>, pick: (g: ReturnType<typeof newGame>) => Enemy | undefined, frames: number): string[] {
    const seen: string[] = [];
    let e: Enemy | undefined;
    for (let i = 0; i < frames; i++) {
      g.step(idle);
      e ??= pick(g);
      if (e && seen[seen.length - 1] !== e.state) seen.push(e.state);
      if (e && !e.alive) break;
    }
    return seen;
  }

  it('Shield Wall divers: formation -> leaving -> attacking -> returning -> formation', () => {
    const g = newGame({ seed: 12 });
    g.invincible = true;
    (g.mission as ShieldWall).field.fill(0); // nothing to crash into
    g.player.x = 15;
    const s = trace(g, (g) => g.enemies.find((e) => e.state === 'leaving'), 3000);
    expect(s.slice(0, 4)).toEqual(['leaving', 'attacking', 'returning', 'formation']);
  });

  it('Laser Attack escorts: leave, attack with a loop, return to orbit', () => {
    const g = newGame({ seed: 12, mission: 1 });
    g.invincible = true;
    const s = trace(g, (g) => g.enemies.find((e) => e.type === 'escort' && e.state === 'leaving'), 3000);
    expect(s.slice(0, 4)).toEqual(['leaving', 'attacking', 'returning', 'formation']);
  });

  it('Laser Attack carriers: drift -> charging -> firing -> drift', () => {
    const g = newGame({ seed: 12, mission: 1 });
    g.invincible = true;
    const s = trace(g, (g) => g.enemies.find((e) => e.type === 'carrier'), 2000);
    expect(s.slice(0, 4)).toEqual(['drift', 'charging', 'firing', 'drift']);
  });

  it('Swarm divers leave the cloud, attack and come back', () => {
    const g = newGame({ seed: 12, mission: 2 });
    g.invincible = true;
    g.player.x = 15;
    const s = trace(g, (g) => g.enemies.find((e) => e.type === 'swarmer' && e.state === 'leaving'), 3000);
    expect(s.slice(0, 4)).toEqual(['leaving', 'attacking', 'returning', 'formation']);
  });

  it('later ranks are faster: a dive at Admiral takes less time than at Cadet', () => {
    const time = (level: number) => {
      const g = newGame({ seed: 12, mission: 2, level });
      g.invincible = true;
      g.player.x = 15;
      let e: Enemy | undefined;
      let start = 0;
      for (let i = 0; i < 4000; i++) {
        g.step(idle);
        if (!e) {
          e = g.enemies.find((x) => x.type === 'swarmer' && x.state === 'attacking');
          if (e) start = i;
        } else if (e.state === 'returning') return i - start;
      }
      return Infinity;
    };
    expect(time(5)).toBeLessThan(time(0));
  });
});
