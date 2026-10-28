/**
 * The five missions, as data: names, looks, formations, counts and the
 * per-rank numbers that tighten them. Index arrays by rank (0 = Cadet ...
 * 5 = Admiral; levels beyond Admiral use the last entry).
 */
import type { LookName } from './looks';

export type MissionId = 'shieldWall' | 'laserAttack' | 'swarm' | 'spaceWarp' | 'flagship';

interface MissionBase {
  id: MissionId;
  name: string;
  look: LookName;
  /** Speech trigger for the title card (see content/speech.ts). */
  intro: string;
}

export const SHIELD_WALL = {
  id: 'shieldWall' as const,
  name: 'SHIELD WALL',
  look: 'shieldWall' as LookName,
  intro: 'missionShieldWall',
  /** Our own formation: a stepped arrowhead. X = a fighter. */
  formation: [
    '..XXXXX..',
    '.XXXXXXX.',
    'XXXXXXXXX',
    'XX.XXX.XX',
    '.XX...XX.',
  ],
  /** Extra row added from this rank up. */
  extraRow: '..XX.XX..',
  extraRowFromRank: 3,
  spacingX: 14,
  spacingY: 12,
  top: 40,
  /** The force field: an arch from the edges up to the apex. */
  field: { x0: 6, x1: 198, apexY: 246, footY: 296, thickness: 5 },
  /** Max fighters peeled off and diving at once, per rank. */
  maxDivers: [1, 2, 2, 3, 3, 4],
} satisfies MissionBase & Record<string, unknown>;

export const LASER_ATTACK = {
  id: 'laserAttack' as const,
  name: 'LASER ATTACK',
  look: 'laserAttack' as LookName,
  intro: 'missionLaserAttack',
  carriers: [2, 2, 3, 3, 3, 3],
  escortsPerCarrier: [4, 4, 5, 5, 5, 6],
  carrierHp: [3, 3, 3, 4, 4, 4],
  /** How many carriers may charge or fire at the same time. */
  maxFiring: [1, 1, 1, 2, 2, 2],
  /** Home heights of the carrier lanes. */
  lanes: [62, 92, 77],
  maxSwooping: [1, 2, 2, 3, 3, 3],
} satisfies MissionBase & Record<string, unknown>;

export const SWARM = {
  id: 'swarm' as const,
  name: 'SWARM',
  look: 'swarm' as LookName,
  intro: 'missionSwarm',
  count: [22, 24, 26, 28, 30, 32],
  /** Share of the swarm that are kamikazes. */
  kamikazeShare: [0.15, 0.18, 0.2, 0.24, 0.28, 0.3],
  groupSize: [2, 3, 3, 3, 4, 4],
  maxDiving: [3, 4, 5, 6, 7, 8],
  cloudRadius: 34,
  cloudY: 92,
} satisfies MissionBase & Record<string, unknown>;

export const SPACE_WARP = {
  id: 'spaceWarp' as const,
  name: 'SPACE WARP',
  look: 'spaceWarp' as LookName,
  intro: 'missionSpaceWarp',
  total: [16, 18, 20, 22, 24, 26],
  maxActive: [4, 4, 5, 5, 6, 7],
  /** Spin direction alternates by spawn; true = both ways from this rank. */
  bothWaysFromRank: 2,
  vortexRadius: 30,
} satisfies MissionBase & Record<string, unknown>;

export const FLAGSHIP_MISSION = {
  id: 'flagship' as const,
  name: 'FLAGSHIP',
  look: 'flagship' as LookName,
  intro: 'missionFlagship',
  maxFighters: [2, 2, 3, 3, 4, 4],
  /** Reactor span either side of the flagship centre (px). */
  reactorHalfW: 5,
} satisfies MissionBase & Record<string, unknown>;

export const MISSIONS = [SHIELD_WALL, LASER_ATTACK, SWARM, SPACE_WARP, FLAGSHIP_MISSION] as const;
export type MissionDef = (typeof MISSIONS)[number];

/** Pick a per-rank value. */
export function byRank<T>(arr: readonly T[], level: number): T {
  return arr[Math.min(level, arr.length - 1)];
}
