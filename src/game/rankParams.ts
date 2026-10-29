import { TUNING } from '../tuning';
import { rankIndex } from '../content/ranks';
import type { Difficulty } from './types';

/** Difficulty multipliers for a level (rank), from tuning.ts. */
export interface RankParams {
  level: number;
  rank: number;
  speed: number;
  fire: number;
  dive: number;
  laserCharge: number;
  swarm: number;
  warpSpawn: number;
  hullRows: number;
}

export function rankParams(level: number, difficulty: Difficulty = 'normal'): RankParams {
  const d = TUNING.difficulty[difficulty];
  const r = TUNING.rank;
  const i = rankIndex(level);
  const extraLoops = Math.min(Math.max(0, level - (r.speed.length - 1)), r.loopCap);
  const extra = extraLoops * r.loopStep;
  return {
    level,
    rank: i,
    speed: r.speed[i] * (1 + extra) * d.speed,
    fire: r.fire[i] * (1 + extra) * d.fire,
    dive: r.dive[i] * (1 + extra) * d.dive,
    // Fairness: no laser ever charges faster than the minimum.
    laserCharge: Math.max(TUNING.minLaserCharge, Math.round(r.laserCharge[i] * (1 - extra) * d.laserCharge)),
    swarm: r.swarm[i] * (1 + extra) * d.swarm,
    warpSpawn: Math.max(30, Math.round(r.warpSpawn[i] * (1 - extra) * d.warpSpawn)),
    hullRows: Math.max(3, r.hullRows[i] + (extraLoops >= 3 ? 1 : 0) + d.hullRows),
  };
}
