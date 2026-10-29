// Find where an invincible AI pilot gets stuck.
import { Game } from '../src/game/game';
import { Bot } from '../src/game/ai';
const g = new Game({ seed: 77, mode: 'arcade', startShips: 3, holdToFire: false, skipCard: true });
g.invincible = true;
const bot = new Bot();
let key = '', since = 0;
for (let i = 0; i < 600000 && g.level < 8; i++) {
  g.step(bot.think(g));
  const k = `${g.level}:${g.missionIndex}`;
  if (k !== key) { key = k; since = i; }
  if (i - since > 40000) {
    const alive = g.enemies.filter((e) => e.alive).map((e) => `${e.type}:${e.state}@${e.x.toFixed(0)},${e.y.toFixed(0)}`);
    console.log('stuck at', key, g.phase, alive.slice(0, 6), (g.mission as any).toSpawn);
    for (let j = 0; j < 4; j++) {
      const e = g.enemies.find((x) => x.alive)!;
      console.log(JSON.stringify({ x: e.x, y: e.y, vx: e.vx, vy: e.vy, t: e.t, state: e.state, px: g.player.x, py: g.player.y }));
      g.step(bot.think(g));
    }
    break;
  }
}
console.log('level', g.level, 'mission', g.missionIndex);
