import { describe, expect, it } from 'vitest';
import { renderSfx, CHIP_RATE } from '../src/audio/chip';
import { SFX, PULSE, LOOPS } from '../src/content/sfx';

describe('the QC-1 sound chip', () => {
  it('renders every effect: audible, bounded, deterministic', () => {
    for (const [id, def] of [...Object.entries(SFX), ['pulse0', PULSE[0]], ['warp', LOOPS.warp]] as const) {
      const a = renderSfx(def);
      expect(a.length, id).toBeGreaterThan(CHIP_RATE / 60);
      let peak = 0;
      for (const v of a) peak = Math.max(peak, Math.abs(v));
      expect(peak, id).toBeGreaterThan(0.05);
      expect(peak, id).toBeLessThanOrEqual(1);
      expect(renderSfx(def), id).toEqual(a);
    }
  });
  it('quantises output (bit-crush)', () => {
    const a = renderSfx(SFX.shot);
    for (const v of a.slice(0, 500)) expect(Math.abs(v * 32 - Math.round(v * 32))).toBeLessThan(1e-6);
  });
});
