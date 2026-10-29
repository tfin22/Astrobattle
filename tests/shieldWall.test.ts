import { describe, expect, it } from 'vitest';
import { newGame, run, idle } from './helpers';
import type { ShieldWall } from '../src/game/missions/shieldWall';
import { TUNING } from '../src/tuning';

describe('Shield Wall', () => {
  it('starts with a full block and an arched field', () => {
    const g = newGame();
    const m = g.mission as ShieldWall;
    expect(g.enemies.filter((e) => e.type === 'drone').length).toBeGreaterThan(25);
    expect(m.fieldPixels()).toBeGreaterThan(500);
    // The apex sits above the player's starting point; the player is under it.
    expect(m.fieldAt(g.player.x, 247)).toBe(true);
    expect(g.player.y).toBeGreaterThan(250);
  });

  it('enemy bombs eat the field', () => {
    const g = newGame();
    const m = g.mission as ShieldWall;
    g.enemies = g.enemies.slice(0, 1); // one fighter left so the mission stays on
    g.enemies[0].y = 30;
    g.player.x = 20; // out of the way
    const before = m.fieldPixels();
    g.dropBomb(102, 200);
    run(g, 60);
    expect(m.fieldPixels()).toBeLessThan(before);
  });

  it('the block marches and speeds up as it thins', () => {
    const g = newGame();
    const m = g.mission as ShieldWall;
    const x0 = m.originX;
    run(g, 120);
    expect(m.originX).not.toBe(x0);
    // Kill all but one: march interval should be at its fastest.
    const drones = g.enemies.filter((e) => e.type === 'drone');
    drones.slice(1).forEach((e) => (e.alive = false));
    run(g, 40);
    expect(m.marchT).toBeLessThanOrEqual(TUNING.wallTickFast + 1);
  });

  it('killing every fighter clears the mission', () => {
    const g = newGame();
    for (const e of g.enemies) g.killEnemy(e);
    run(g, 2, idle);
    expect(g.phase).toBe('clear');
    expect(g.score).toBeGreaterThan(0);
  });

  it('death costs a ship, pauses, and the surviving enemies stay put', () => {
    const g = newGame();
    run(g, 30);
    const before = g.enemies.map((e) => [e.id, e.x, e.y].join());
    g.killPlayer();
    expect(g.phase).toBe('dying');
    expect(g.lives).toBe(2);
    run(g, 30);
    expect(g.enemies.map((e) => [e.id, e.x, e.y].join())).toEqual(before);
    run(g, TUNING.deathPause);
    expect(g.phase).toBe('play');
    expect(g.player.alive).toBe(true);
    expect(g.player.invuln).toBeGreaterThan(0);
  });

  it('losing the last ship ends the game', () => {
    const g = newGame({ startShips: 1 });
    g.killPlayer();
    run(g, TUNING.deathPause + 2);
    expect(g.phase).toBe('over');
    run(g, TUNING.gameOverFrames + 2);
    expect(g.phase).toBe('done');
  });
});
