/**
 * A sprite is a list of animation frames; each frame is rows of characters.
 * '.' is transparent; '1'..'9' pick from the pen list the drawer supplies,
 * so one sprite can be shown in different colours.
 */
export interface SpriteDef {
  name: string;
  frames: string[][];
}

export function sprite(name: string, ...frames: string[][]): SpriteDef {
  const w = frames[0][0].length;
  const h = frames[0].length;
  for (const f of frames) {
    if (f.length !== h || f.some((r) => r.length !== w)) {
      throw new Error(`sprite ${name}: frames must share one size`);
    }
  }
  return { name, frames };
}

export function spriteSize(def: SpriteDef): { w: number; h: number } {
  return { w: def.frames[0][0].length, h: def.frames[0].length };
}
