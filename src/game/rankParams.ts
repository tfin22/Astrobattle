import { TUNING } from '../tuning';
import { rankIndex } from '../content/ranks';

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

export function rankParams(level: number): RankParams {
  const r = TUNING.rank;
  const i = rankIndex(level);
  const extraLoops = Math.min(Math.max(0, level - (r.speed.length - 1)), r.loopCap);
  const extra = extraLoops * r.loopStep;
  return {
    level,
    rank: i,
    speed: r.speed[i] * (1 + extra),
    fire: r.fire[i] * (1 + extra),
    dive: r.dive[i] * (1 + extra),
    // Fairness: no laser ever charges faster than the minimum.
    laserCharge: Math.max(TUNING.minLaserCharge, Math.round(r.laserCharge[i] * (1 - extra))),
    swarm: r.swarm[i] * (1 + extra),
    warpSpawn: Math.max(30, Math.round(r.warpSpawn[i] * (1 - extra))),
    hullRows: r.hullRows[i] + (extraLoops >= 3 ? 1 : 0),
  };
}
