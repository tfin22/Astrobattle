import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { fatan2, fcos, fsin } from '../src/core/fmath';
import { computeLayout } from '../src/render/layout';
import { FB_H, FB_W, Framebuffer, textWidth, wrapText } from '../src/render/framebuffer';
import { buildLineMap } from '../src/render/colours';
import { LOOKS } from '../src/content/looks';
import { BIG, SMALL } from '../src/content/font';

describe('seeded RNG', () => {
  it('repeats exactly for the same seed', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    for (let i = 0; i < 1000; i++) expect(a.nextU32()).toBe(b.nextU32());
  });
  it('differs for different seeds and stays in range', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
    for (let i = 0; i < 1000; i++) {
      const v = a.int(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });
  it('derives independent streams', () => {
    expect(Rng.derive(5, 1).nextU32()).not.toBe(Rng.derive(5, 2).nextU32());
    expect(Rng.derive(5, 1).nextU32()).toBe(Rng.derive(5, 1).nextU32());
  });
});

describe('deterministic trig', () => {
  it('matches Math closely', () => {
    for (let a = -10; a < 10; a += 0.137) {
      expect(Math.abs(fsin(a) - Math.sin(a))).toBeLessThan(1e-5);
      expect(Math.abs(fcos(a) - Math.cos(a))).toBeLessThan(1e-5);
    }
    for (let i = 0; i < 100; i++) {
      const y = Math.sin(i * 1.3) * 5;
      const x = Math.cos(i * 0.7) * 5;
      expect(Math.abs(fatan2(y, x) - Math.atan2(y, x))).toBeLessThan(2e-4);
    }
  });
});

describe('portrait layout', () => {
  it('uses integer scaling on a 390x844 phone and keeps controls below the picture', () => {
    const l = computeLayout(390, 844, 3, true);
    expect(l.integer).toBe(true);
    expect(l.scale).toBe(5);
    expect(l.play.y + l.play.h).toBeLessThanOrEqual(l.controls.y);
    expect(l.controls.h / 3).toBeGreaterThanOrEqual(180);
    expect(l.play.w).toBeLessThanOrEqual(l.devW);
  });
  it('centres the picture with no controls on desktop', () => {
    const l = computeLayout(1280, 800, 1, false);
    expect(l.controls.h).toBe(0);
    expect(l.play.h).toBeLessThanOrEqual(800);
  });
  it('still fills a small phone (fractional fallback)', () => {
    const l = computeLayout(360, 640, 1, true);
    expect(l.play.w).toBeGreaterThan(200);
  });
});

describe('framebuffer', () => {
  it('draws text and converts through the line map', () => {
    const fb = new Framebuffer();
    const w = fb.text('HI 0', 0, 0, 4);
    expect(w).toBe(textWidth('HI 0'));
    expect(fb.px.some((p) => p === 4)).toBe(true);
    buildLineMap(fb.lineMap, LOOKS.attract, 0);
    const out = new Uint32Array(FB_W * FB_H);
    fb.toRGBA(out);
    expect(out.every((v) => v >>> 24 === 0xff)).toBe(true);
  });
  it('wraps long lines', () => {
    const lines = wrapText('INSERT COIN. VORG IS HUNGRY.', 150);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(textWidth(l)).toBeLessThanOrEqual(150);
  });
  it('fonts are well formed', () => {
    for (const [ch, g] of Object.entries(BIG)) {
      expect(g.length, ch).toBe(7);
      expect(new Set(g.map((r) => r.length)).size, ch).toBe(1);
    }
    for (const [ch, g] of Object.entries(SMALL)) {
      expect(g.length, ch).toBe(5);
      expect(new Set(g.map((r) => r.length)).size, ch).toBe(1);
    }
  });
});
