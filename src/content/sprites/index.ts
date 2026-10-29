import * as ships from './ships';
import * as enemies from './enemies';
import * as vorg from './vorg';
import type { SpriteDef } from './types';

export * from './ships';
export * from './enemies';
export * from './vorg';

function isSprite(v: unknown): v is SpriteDef {
  return typeof v === 'object' && v !== null && 'frames' in v && 'name' in v;
}

/** Every sprite, for the debug sprite viewer and tests. */
export const ALL_SPRITES: SpriteDef[] = [
  ...Object.values(ships),
  ...Object.values(enemies),
  ...Object.values(vorg),
].filter(isSprite);
