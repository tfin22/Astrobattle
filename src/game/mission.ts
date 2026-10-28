import type { MissionId } from '../content/missions';
import type { Bullet, Enemy } from './types';
import type { Game } from './game';

/** What each of the five missions provides to the game loop. */
export interface Mission {
  readonly id: MissionId;
  init(g: Game): void;
  /** Enemy behaviour, spawning and enemy fire. */
  update(g: Game): void;
  /** Shot against scenery (force field, hull, reactor). True = shot used up. */
  shotScenery?(g: Game, x: number, y: number): boolean;
  /** Enemy bullet against scenery. True = bullet used up. */
  bulletScenery?(g: Game, b: Bullet): boolean;
  /** Called when the player's shot hits an enemy. True = handled here. */
  onHit?(g: Game, e: Enemy): boolean;
  onKill?(g: Game, e: Enemy): void;
  isClear(g: Game): boolean;
  /** 0..1, how much of the mission's enemies remain (pulse speed). */
  remaining(g: Game): number;
  /** True if this mission beats its own background pulse. */
  readonly ownPulse?: boolean;
}
