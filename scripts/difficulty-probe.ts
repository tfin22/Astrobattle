// How hard is each difficulty? The AI pilot plays every mission many times.
// Usage: npx vite-node scripts/difficulty-probe.ts [level] [seeds]
import { Game } from '../src/game/game';
import { Bot } from '../src/game/ai';
import type { Difficulty } from '../src/game/types';
const level = Number(process.argv[2] ?? 0);
const seeds = Number(process.argv[3] ?? 16);
for (const difficulty of ['easy', 'normal', 'hard'] as Difficulty[]) {
  const perMission: string[] = [];
  let total = 0;
  for (let mission = 0; mission < 5; mission++) {
    const deaths: number[] = [];
    for (let seed = 1; seed <= seeds; seed++) {
      const g = new Game({ seed: seed * 7919, mode: 'arcade', startShips: 99, holdToFire: false, skipCard: true, difficulty, mission, level, single: true });
      const bot = new Bot();
      for (let f = 0; f < 12000 && g.phase !== 'done'; f++) g.step(bot.think(g));
      deaths.push(g.stats.deaths);
    }
    deaths.sort((a, b) => a - b);
    const mean = deaths.reduce((a, b) => a + b, 0) / seeds;
    total += mean;
    perMission.push(`m${mission + 1} ${mean.toFixed(1)} (median ${deaths[seeds >> 1]})`);
  }
  console.log(`${difficulty.padEnd(6)} level ${level}: ${total.toFixed(1)} ships per loop | ${perMission.join(' | ')}`);
}
