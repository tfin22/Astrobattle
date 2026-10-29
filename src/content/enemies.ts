import type { PenName } from '../palette';
import type { SpriteDef } from './sprites/types';
import { CARRIER, DRONE, ESCORT, KAMIKAZE, SAUCER, STINGER, SWARMER, WARP_L, WARP_M, WARP_S } from './sprites';

/**
 * The cast. Each enemy type: its sprite(s), the pens its sprite digits map
 * to, and its hitbox (always a little smaller than the sprite).
 */
export interface EnemyType {
  name: string;
  /** Sprites by size stage (only Space Warp uses more than one). */
  sprites: SpriteDef[];
  pens: PenName[];
  /** Pens while attacking (a colour change warns you it has left formation). */
  attackPens?: PenName[];
  hit: { w: number; h: number }[];
  hp: number;
  /** Frames per animation frame. */
  anim: number;
}

export const ENEMY_TYPES = {
  drone: {
    name: 'DRONE', sprites: [DRONE], pens: ['EA1', 'EA2', 'EA3'], attackPens: ['EB1', 'EB2', 'EB3'],
    hit: [{ w: 9, h: 5 }], hp: 1, anim: 0,
  },
  stinger: {
    name: 'STINGER', sprites: [STINGER], pens: ['EB1', 'EB2', 'EB3'],
    hit: [{ w: 7, h: 7 }], hp: 1, anim: 8,
  },
  carrier: {
    name: 'CARRIER', sprites: [CARRIER], pens: ['EC1', 'EC2', 'EC3'],
    hit: [{ w: 19, h: 7 }], hp: 2, anim: 14,
  },
  escort: {
    name: 'ESCORT', sprites: [ESCORT], pens: ['EB1', 'EB2', 'WHITE'],
    hit: [{ w: 7, h: 5 }], hp: 1, anim: 10,
  },
  swarmer: {
    name: 'SWARMER', sprites: [SWARMER], pens: ['EA1', 'EA2', 'WHITE'],
    hit: [{ w: 7, h: 6 }], hp: 1, anim: 7,
  },
  kamikaze: {
    name: 'KAMIKAZE', sprites: [KAMIKAZE], pens: ['EB1', 'EB2', 'SHOT'],
    hit: [{ w: 5, h: 7 }], hp: 1, anim: 6,
  },
  warpling: {
    name: 'WARPLING', sprites: [WARP_S, WARP_M, WARP_L], pens: ['EA1', 'EA2', 'WHITE'],
    hit: [{ w: 4, h: 4 }, { w: 7, h: 7 }, { w: 11, h: 11 }], hp: 1, anim: 9,
  },
  fighter: {
    name: 'FIGHTER', sprites: [ESCORT], pens: ['EB1', 'EB2', 'WHITE'],
    hit: [{ w: 7, h: 5 }], hp: 1, anim: 10,
  },
  saucer: {
    name: 'SAUCER', sprites: [SAUCER], pens: ['HUD1', 'WHITE', 'SHOT'],
    hit: [{ w: 13, h: 5 }], hp: 1, anim: 8,
  },
} satisfies Record<string, EnemyType>;

export type EnemyTypeName = keyof typeof ENEMY_TYPES;
