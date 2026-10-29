import { describe, expect, it } from 'vitest';
import { rankParams } from '../src/game/rankParams';
import { TUNING } from '../src/tuning';
import { Game } from '../src/game/game';
import { Bot } from '../src/game/ai';
import { DEFAULT_SETTINGS, loadSettings } from '../src/platform/storage';
import { newGame, run } from './helpers';
import type { Difficulty } from '../src/game/types';

describe('difficulty', () => {
  it('easy is the original tuning; normal is the default', () => {
    const r = TUNING.rank;
    for (let level = 0; level < 6; level++) {
      const e = rankParams(level, 'easy');
      expect(e.speed).toBe(r.speed[level]);
      expect(e.fire).toBe(r.fire[level]);
      expect(e.laserCharge).toBe(r.laserCharge[level]);
      expect(e.hullRows).toBe(r.hullRows[level]);
    }
    expect(rankParams(3)).toEqual(rankParams(3, 'normal'));
  });

  it('easy is gentler and hard is tougher on every screw, at every rank', () => {
    for (let level = 0; level < 12; level++) {
      const e = rankParams(level, 'easy');
      const n = rankParams(level, 'normal');
      const h = rankParams(level, 'hard');
      for (const k of ['speed', 'fire', 'dive', 'swarm'] as const) {
        expect(e[k], `${k} ${level}`).toBeLessThan(n[k]);
        expect(h[k], `${k} ${level}`).toBeGreaterThan(n[k]);
      }
      expect(e.laserCharge).toBeGreaterThanOrEqual(n.laserCharge);
      expect(h.laserCharge).toBeLessThanOrEqual(n.laserCharge);
      expect(e.warpSpawn).toBeGreaterThanOrEqual(n.warpSpawn);
      expect(h.warpSpawn).toBeLessThanOrEqual(n.warpSpawn);
      expect(e.hullRows).toBeLessThanOrEqual(n.hullRows);
      expect(h.hullRows).toBeGreaterThanOrEqual(n.hullRows);
    }
  });

  it('hard never breaks fairness: lasers still warn for the minimum', () => {
    for (let level = 0; level < 40; level++) {
      expect(rankParams(level, 'hard').laserCharge).toBeGreaterThanOrEqual(TUNING.minLaserCharge);
      expect(rankParams(level, 'easy').hullRows).toBeGreaterThanOrEqual(3);
    }
  });

  it('changes how much the enemy fires in a real game', () => {
    const bombs = (difficulty: Difficulty) => {
      let n = 0;
      for (let seed = 1; seed <= 10; seed++) {
        const g = newGame({ seed, difficulty });
        g.invincible = true;
        for (let i = 0; i < 1500; i++) {
          g.step({ mx: 0, my: 0, fire: false, fireHeld: false });
          n += g.events.filter((e) => e.t === 'sfx' && e.id === 'enemyShot').length;
        }
      }
      return n;
    };
    const e = bombs('easy');
    const n = bombs('normal');
    const h = bombs('hard');
    expect(e).toBeLessThan(n);
    expect(h).toBeGreaterThan(n);
  });

  it('the same pilot loses fewer ships on easy than on hard', () => {
    const deaths = (difficulty: Difficulty) => {
      let d = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const g = new Game({ seed, mode: 'arcade', startShips: 9, holdToFire: false, skipCard: true, difficulty, mission: seed % 5, level: 2, single: true });
        const bot = new Bot();
        for (let i = 0; i < 3600 && g.phase !== 'done'; i++) g.step(bot.think(g));
        d += g.stats.deaths;
      }
      return d;
    };
    expect(deaths('easy')).toBeLessThan(deaths('hard'));
  });

  it('hard gives a shorter respawn grace', () => {
    const grace = (difficulty: Difficulty) => {
      const g = newGame({ difficulty });
      g.killPlayer();
      run(g, TUNING.deathPause + 1);
      return g.player.invuln;
    };
    expect(grace('easy')).toBe(grace('normal'));
    expect(grace('hard')).toBeLessThan(grace('normal'));
  });

  it('the setting defaults to normal', () => {
    expect(DEFAULT_SETTINGS.difficulty).toBe('normal');
    expect(loadSettings().difficulty).toBe('normal');
  });
});
