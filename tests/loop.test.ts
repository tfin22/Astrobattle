import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { Bot } from '../src/game/ai';
import { TUNING } from '../src/tuning';
import { rankParams } from '../src/game/rankParams';
import { rankLabel } from '../src/content/ranks';
import { packInput, unpackInput, type FrameInput } from '../src/game/types';
import { newGame } from './helpers';

describe('the loop', () => {
  it('all five missions are clearable at every rank, and the loop runs on past Admiral', () => {
    const g = new Game({ seed: 77, mode: 'arcade', startShips: 3, holdToFire: false, skipCard: true });
    g.invincible = true;
    const bot = new Bot();
    const played = new Set<string>();
    for (let i = 0; i < 2_000_000 && g.level < 8; i++) {
      g.step(bot.think(g));
      if (g.phase === 'play') played.add(`${g.level}:${g.missionIndex}`);
    }
    expect(g.level).toBe(8);
    for (let level = 0; level < 8; level++) for (let m = 0; m < 5; m++) expect(played.has(`${level}:${m}`), `${level}:${m}`).toBe(true);
    expect(rankLabel(g.level)).toBe('QUANTUM ADMIRAL *4');
  });

  it('nothing ever spawns near the player, in any mission at any rank', () => {
    for (let level = 0; level < 7; level += 2) {
      for (let mission = 0; mission < 5; mission++) {
        const g = new Game({ seed: level * 10 + mission, mode: 'arcade', startShips: 3, holdToFire: false, skipCard: true, mission, level, single: true });
        g.invincible = true;
        const bot = new Bot();
        for (let i = 0; i < 6000 && g.phase !== 'done'; i++) g.step(bot.think(g));
        expect(g.stats.minSpawnDist, `m${mission} l${level}`).toBeGreaterThanOrEqual(TUNING.minSpawnDistance);
      }
    }
  });

  it('rank scaling tightens every screw but never breaks fairness', () => {
    let prev = rankParams(0);
    for (let level = 1; level < 14; level++) {
      const p = rankParams(level);
      expect(p.speed).toBeGreaterThanOrEqual(prev.speed);
      expect(p.fire).toBeGreaterThanOrEqual(prev.fire);
      expect(p.laserCharge).toBeLessThanOrEqual(prev.laserCharge);
      expect(p.laserCharge).toBeGreaterThanOrEqual(TUNING.minLaserCharge);
      expect(p.hullRows).toBeGreaterThanOrEqual(prev.hullRows);
      prev = p;
    }
    // Capped after enough loops.
    expect(rankParams(40).speed).toBe(rankParams(20).speed);
  });
});

describe('replays', () => {
  it('a same-seed game with the same inputs replays identically', () => {
    const record: number[] = [];
    const a = newGame({ seed: 4242, skipCard: false });
    const bot = new Bot();
    for (let i = 0; i < 6000; i++) {
      const inp = bot.think(a);
      record.push(packInput(inp));
      a.step(inp);
    }
    const b = newGame({ seed: 4242, skipCard: false });
    for (const r of record) b.step(unpackInput(r));
    expect(b.hash()).toBe(a.hash());
    expect(b.score).toBe(a.score);
    expect(b.frame).toBe(a.frame);
  });

  it('different seeds play differently', () => {
    const run = (seed: number) => {
      const g = newGame({ seed });
      const bot = new Bot();
      for (let i = 0; i < 1500; i++) g.step(bot.think(g));
      return g.hash();
    };
    expect(run(1)).not.toBe(run(2));
  });

  it('inputs pack into a byte and back', () => {
    for (const mx of [-1, 0, 1]) for (const my of [-1, 0, 1]) for (const fire of [false, true]) {
      const i: FrameInput = { mx, my, fire, fireHeld: !fire };
      expect(unpackInput(packInput(i))).toEqual(i);
    }
  });
});

describe('scoring and extra ships', () => {
  it('more points for an attacking enemy than one in formation', () => {
    const g = newGame();
    const [a, b] = g.enemies;
    let s = g.score;
    g.killEnemy(a);
    const formation = g.score - s;
    g.setState(b, 'attacking');
    s = g.score;
    g.killEnemy(b);
    expect(g.score - s).toBeGreaterThan(formation);
  });

  it('awards an extra ship at the threshold, then every interval', () => {
    const g = newGame();
    const lives = g.lives;
    g.addScore(TUNING.extraShipFirst);
    g.step({ mx: 0, my: 0, fire: false, fireHeld: false });
    expect(g.lives).toBe(lives + 1);
    g.addScore(TUNING.extraShipEvery);
    g.step({ mx: 0, my: 0, fire: false, fireHeld: false });
    expect(g.lives).toBe(lives + 2);
  });

  it('mission bonus scales with rank', () => {
    const a = newGame({ level: 0 });
    const b = newGame({ level: 3 });
    for (const g of [a, b]) {
      for (const e of g.enemies) g.killEnemy(e, false);
      g.step({ mx: 0, my: 0, fire: false, fireHeld: false });
    }
    expect(b.score).toBeGreaterThan(a.score);
  });

  it('free play: continuing resets the score and marks the game', () => {
    const g = newGame({ mode: 'free', startShips: 1 });
    g.addScore(5000);
    g.continueGame();
    expect(g.score).toBe(0);
    expect(g.continued).toBe(true);
    expect(g.lives).toBe(1);
  });
});
