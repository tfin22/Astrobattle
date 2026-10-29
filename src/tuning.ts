/**
 * Every tuning value in the game lives here. Units: pixels of the 204x320
 * arcade picture, and frames at 60 per second.
 */
export const TUNING = {
  // ---- Screen regions -------------------------------------------------
  hudTop: 18,            // rows reserved for score/hi-score at the top
  hudBottom: 12,         // rows reserved for ships/rank at the bottom
  /** The player's zone: roughly the lowest quarter of the playfield. */
  zoneTop: 236,
  zoneBottom: 300,
  zoneMarginX: 8,

  // ---- Player -----------------------------------------------------------
  shipSpeed: 1.45,       // px per frame, no inertia
  startShips: 3,         // setting: 3..5
  extraShipFirst: 10000,
  extraShipEvery: 30000,
  /** Player hitbox, generous: much smaller than the 13x11 sprite. */
  playerHitW: 7,
  playerHitH: 5,
  respawnGrace: 90,      // invulnerable frames after a respawn
  deathPause: 120,       // frames between death and respawn

  // ---- The quantum shot ---------------------------------------------------
  shotSpeed: 5.2,
  shotLength: 6,

  // ---- Touch controls -----------------------------------------------------
  stickDeadZoneCss: 10,
  stickRadiusCss: 46,    // the firm edge; the stick base follows beyond it
  dpadDeadZoneCss: 14,

  // ---- Enemy fire -----------------------------------------------------------
  bombSpeed: 1.25,
  dartSpeed: 2.6,
  maxEnemyBullets: 7,
  /** Nothing may spawn closer than this to the player (fairness). */
  minSpawnDistance: 60,
  /** No laser fires with less warning than this, at any rank. */
  minLaserCharge: 45,

  // ---- Shield Wall ----------------------------------------------------------
  wallStepX: 2,
  wallStepDown: 5,
  wallTickSlow: 24,      // frames per march step with a full block
  wallTickFast: 2,       // the last fighter
  wallFloor: 196,        // the block never marches lower than this
  wallBombChance: 0.022, // per march-step per eligible shooter
  wallDiveEvery: 260,    // frames between peel-offs (Cadet)
  diverSpeed: 1.25,

  // ---- Laser Attack -----------------------------------------------------------
  carrierSpeed: 0.45,
  laserCharge: 80,       // frames of visible charge-up (Cadet)
  laserFire: 40,         // frames the beam stays on
  laserCooldown: 170,
  laserWidth: 5,
  escortSwoopEvery: 120,
  escortSpeed: 1.6,

  // ---- Swarm --------------------------------------------------------------------
  swarmDriftSpeed: 0.006,  // radians per frame of the cloud's wander
  swarmBreathe: 0.035,
  swarmDiveEvery: 150,
  swarmDiveSpeed: 1.7,
  kamikazeSpeed: 2.1,
  kamikazeLead: 1.0,       // how much of the player's motion it predicts

  // ---- Space Warp -----------------------------------------------------------------
  warpCentreY: 128,
  warpSpawnEvery: 70,
  warpSpin: 0.022,         // radians per frame
  warpGrowth: 0.38,        // px of radius per frame (grows as it goes)
  warpFireRadius: 55,      // they start firing once this far out

  // ---- Flagship ---------------------------------------------------------------------
  flagshipSpeed: 0.5,
  flagshipY: 58,
  hullCols: 15,
  hullBlockW: 4,
  hullBlockH: 3,
  flagshipFighterEvery: 220,
  flagshipBombEvery: 70,
  boomFrames: 260,

  // ---- Saucer -----------------------------------------------------------------------
  saucerEvery: 1500,
  saucerSpeed: 0.9,

  // ---- Flow -------------------------------------------------------------------------
  cardFrames: 210,         // mission title card
  cardSkipAfter: 40,
  clearFrames: 120,
  promotionFrames: 240,
  gameOverFrames: 260,

  // ---- VORG -------------------------------------------------------------------------
  speechCooldown: 240,     // frames of silence after a line ends
  nearMissDistance: 9,
  missStreakLength: 5,

  /**
   * Thinning: as a wave is cleared, the survivors speed up and fire more,
   * ramping hardest at the end (x (1 + k * cleared^2)). The last one is
   * quick and dangerous. Not used by the Flagship.
   */
  thinning: { speed: 0.6, fire: 1.2 },
  /** Ceiling on rank x difficulty x thinning speed, so the last enemy stays shootable. */
  maxEnemyPace: 2.0,

  // ---- Background pulse -------------------------------------------------------------
  pulseSlow: 52,
  /** Fastest the beat ever gets: frames between thumps (18 = 3.3 a second). */
  pulseFast: 18,

  /**
   * Rank scaling. Index 0 = Cadet ... 5 = Admiral. Applied on top of the
   * base values above. After Admiral each further loop adds `loopStep`
   * to the Admiral multipliers, up to `loopCap` extra loops.
   */
  rank: {
    speed:      [1.00, 1.10, 1.20, 1.30, 1.40, 1.50],
    fire:       [1.00, 1.18, 1.36, 1.55, 1.75, 1.95],
    dive:       [1.00, 1.15, 1.30, 1.48, 1.66, 1.85],
    laserCharge:[80,   72,   65,   58,   52,   47],
    swarm:      [1.00, 1.12, 1.25, 1.38, 1.52, 1.66],
    warpSpawn:  [70,   62,   55,   49,   44,   40],
    hullRows:   [4,    5,    5,    6,    6,    7],
    loopStep: 0.05,
    loopCap: 6,
  },

  /**
   * The difficulty setting, applied on top of rank scaling. Easy is the
   * original tuning (playtest round 1); Normal and Hard step up from it.
   * Multipliers, except hullRows (rows added) and grace (x the respawn
   * grace). Lasers never charge faster than minLaserCharge.
   */
  difficulty: {
    easy:   { speed: 1,    fire: 1,    dive: 1,    swarm: 1,    laserCharge: 1,    warpSpawn: 1,    hullRows: 0, grace: 1 },
    normal: { speed: 1.12, fire: 1.35, dive: 1.25, swarm: 1.15, laserCharge: 0.85, warpSpawn: 0.85, hullRows: 1, grace: 1 },
    hard:   { speed: 1.25, fire: 1.75, dive: 1.5,  swarm: 1.3,  laserCharge: 0.72, warpSpawn: 0.72, hullRows: 2, grace: 0.8 },
  },
} as const;
