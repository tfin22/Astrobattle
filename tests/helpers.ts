import { Game } from '../src/game/game';
import { Bot, type BotStyle } from '../src/game/ai';
import type { FrameInput, GameOptions } from '../src/game/types';

export function newGame(over: Partial<GameOptions> = {}): Game {
  return new Game({ seed: 1, mode: 'arcade', startShips: 3, holdToFire: false, skipCard: true, ...over });
}

export const idle: FrameInput = { mx: 0, my: 0, fire: false, fireHeld: false };
export const press: FrameInput = { mx: 0, my: 0, fire: true, fireHeld: true };

export function run(g: Game, frames: number, input: FrameInput | ((g: Game) => FrameInput) = idle): void {
  for (let i = 0; i < frames; i++) g.step(typeof input === 'function' ? input(g) : input);
}

/** Play one mission with a bot for a fixed time; returns the score. */
export function botScore(style: BotStyle, seed: number, frames: number, over: Partial<GameOptions> = {}): number {
  const g = newGame({ seed, single: true, ...over });
  const bot = new Bot(style);
  for (let i = 0; i < frames && g.phase !== 'done'; i++) g.step(bot.think(g));
  return g.score;
}
