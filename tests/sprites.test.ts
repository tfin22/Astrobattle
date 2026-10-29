import { describe, expect, it } from 'vitest';
import { ALL_SPRITES } from '../src/content/sprites';

describe('sprites', () => {
  it('every sprite has 1-4 frames of one size', () => {
    expect(ALL_SPRITES.length).toBeGreaterThan(10);
    for (const s of ALL_SPRITES) {
      expect(s.frames.length, s.name).toBeGreaterThanOrEqual(1);
      expect(s.frames.length, s.name).toBeLessThanOrEqual(4);
      const w = s.frames[0][0].length;
      for (const f of s.frames) for (const r of f) expect(r.length, s.name).toBe(w);
    }
  });
});
