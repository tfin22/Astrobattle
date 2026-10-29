import type { EnemyTypeName } from './enemies';

/** Points. More for enemies hit while attacking than in formation. */
export const SCORING = {
  enemies: {
    drone: { formation: 30, attacking: 80 },
    stinger: { formation: 80, attacking: 150 },
    carrier: { formation: 300, attacking: 300 },
    escort: { formation: 50, attacking: 120 },
    swarmer: { formation: 50, attacking: 120 },
    kamikaze: { formation: 100, attacking: 200 },
    // Space Warp: hit them small (early) for the most; big ones are worth
    // a bit more than medium because they're on top of you.
    warpling: { formation: 200, attacking: 150, stages: [200, 100, 150] },
    fighter: { formation: 80, attacking: 150 },
    saucer: { formation: 0, attacking: 0 },
  } satisfies Record<EnemyTypeName, { formation: number; attacking: number; stages?: number[] }>,
  /** Shooting a carrier while its laser charges. */
  carrierCancelBonus: 400,
  /** A bonus saucer is worth one of these, picked at random. */
  saucer: [100, 150, 200, 300, 500],
  /** Each hull block chipped off the flagship. */
  hullBlock: 10,
  /** Destroying the flagship's reactor. */
  reactor: 5000,
  /** Mission-complete bonus, multiplied by (rank level + 1). */
  missionBonus: 500,
} as const;
