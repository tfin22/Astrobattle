// Ad-hoc probe: run the bot through one mission and report.
import { Game } from '../src/game/game';
import { Bot } from '../src/game/ai';
const mission = Number(process.argv[2] ?? 4);
const level = Number(process.argv[3] ?? 0);
const seeds = Number(process.argv[4] ?? 5);
for (let seed = 1; seed <= seeds; seed++) {
  const g = new Game({ seed, mode: 'arcade', startShips: 3, holdToFire: false, mission, level, single: true, skipCard: true });
  g.invincible = process.env.MORTAL ? false : true;
  const bot = new Bot();
  let maxF = 0, spawns = 0, f = 0;
  for (; f < 30000 && g.phase !== 'done'; f++) {
    g.step(bot.think(g));
    spawns += g.events.filter((e) => e.t === 'spawn' && e.type !== 'saucer').length;
    maxF = Math.max(maxF, g.enemies.filter((e) => e.alive && e.type !== 'saucer').length);
  }
  console.log(`seed ${seed}: ${g.phase} after ${f} frames (${(f / 60).toFixed(0)} s), score ${g.score}, deaths ${g.stats.deaths}, spawns ${spawns}, max on screen ${maxF}, shots ${g.stats.shotsFired}`);
}
