import type { EnemyTypeName } from '../content/enemies';

export interface FrameInput {
  mx: number;
  my: number;
  fire: boolean;
  fireHeld: boolean;
}

export const NO_INPUT: FrameInput = { mx: 0, my: 0, fire: false, fireHeld: false };

/** Pack an input into one byte (replays). */
export function packInput(i: FrameInput): number {
  return ((i.mx + 1) & 3) | (((i.my + 1) & 3) << 2) | (i.fire ? 16 : 0) | (i.fireHeld ? 32 : 0);
}
export function unpackInput(b: number): FrameInput {
  return { mx: (b & 3) - 1, my: ((b >> 2) & 3) - 1, fire: (b & 16) !== 0, fireHeld: (b & 32) !== 0 };
}

/**
 * Per-enemy state machine. Formation flyers go
 *   formation -> leaving -> attacking -> returning -> formation.
 * Carriers use drift -> charging -> firing -> drift. Warp spawn use emerging.
 */
export type EnemyState =
  | 'formation' | 'leaving' | 'attacking' | 'returning'
  | 'drift' | 'charging' | 'firing'
  | 'emerging';

export interface Enemy {
  id: number;
  type: EnemyTypeName;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: EnemyState;
  /** Frames spent in the current state. */
  t: number;
  hp: number;
  /** Home offset in its formation / cloud / orbit. */
  hx: number;
  hy: number;
  /** General purpose: angle, radius, phase, lane, path parameters. */
  a: number;
  r: number;
  p0: number;
  p1: number;
  p2: number;
  /** Size stage (Space Warp), or 0. */
  stage: number;
  /** Which carrier an escort belongs to, which group a diver flies with. */
  link: number;
  /** Frames left of the white hit flash. */
  flash: number;
  /** Cooldown counter (fire, laser). */
  cool: number;
  alive: boolean;
}

export type BulletType = 'bomb' | 'dart';

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: BulletType;
  grazed: boolean;
  alive: boolean;
}

export interface Shot {
  x: number;
  y: number;
  alive: boolean;
}

export type ParticleKind = 'spark' | 'ring' | 'pop' | 'debris' | 'text';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  /** Ring radius / growth, or text. */
  r: number;
  vr: number;
  text?: string;
  pen?: number;
}

export type SfxId =
  | 'shot' | 'cancel' | 'enemyShot' | 'dart' | 'explodeSmall' | 'explodeLarge'
  | 'fizz' | 'chip' | 'clink' | 'laserCharge' | 'laserFire' | 'warpOut'
  | 'flagAlarm' | 'flagBoom' | 'death' | 'extraLife' | 'fanfare' | 'coin'
  | 'saucer' | 'saucerHit' | 'hitCarrier' | 'promote' | 'tick' | 'start';

export type HapticId = 'fire' | 'death' | 'boom' | 'tap';

export type GameEvent =
  | { t: 'sfx'; id: SfxId; dur?: number }
  | { t: 'sfxStop'; id: SfxId }
  | { t: 'say'; trigger: string; text: string; ph: string; frames: number }
  | { t: 'haptic'; id: HapticId }
  | { t: 'pulse'; beat: number }
  | { t: 'kill'; type: EnemyTypeName; x: number; y: number }
  | { t: 'spawn'; type: EnemyTypeName; x: number; y: number; dist: number };

export type Phase = 'card' | 'play' | 'dying' | 'clear' | 'boom' | 'promotion' | 'over' | 'done';

export type GameMode = 'arcade' | 'free' | 'practice' | 'demo';

export interface GameOptions {
  seed: number;
  mode: GameMode;
  startShips: number;
  holdToFire: boolean;
  /** Starting level (0 = Cadet). */
  level?: number;
  /** Starting mission index 0..4. */
  mission?: number;
  /** Practice: stop after this one mission. */
  single?: boolean;
  /** Skip the title card (tests, demo). */
  skipCard?: boolean;
}
