/**
 * Colour, arcade style.
 *
 * The 1981 hardware held a 256-entry master palette but each pixel only chose
 * one of a handful of colour registers; games rewrote those registers between
 * scanlines to paint the screen in bands. We do the same:
 *
 *  - MASTER: 256 colours, 32 hues x 8 brightness levels (index = hue*8 + lum).
 *  - The framebuffer stores PENS (0..31), not colours.
 *  - Every scanline has its own pen -> colour table, built each frame from a
 *    "look" (bands, per-line gradients and colour cycles; see content/looks.ts).
 */

export const HUES = 32;
export const LUMS = 8;

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6) % 6;
  const f = h * 6 - Math.floor(h * 6);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const m: [number, number, number][] = [
    [v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q],
  ];
  return m[i];
}

/** RGB triples for the 256 master colours. */
export const MASTER: [number, number, number][] = [];
for (let hue = 0; hue < HUES; hue++) {
  for (let lum = 0; lum < LUMS; lum++) {
    if (hue === 0) {
      const g = Math.round((lum / 7) ** 1.15 * 255);
      MASTER.push([g, g, g]);
      continue;
    }
    const h = (hue - 1) / 31;
    // Dark levels ramp brightness at full saturation; the top levels wash
    // toward white, like an overdriven CRT phosphor.
    const v = Math.min(1, 0.18 + lum * 0.16);
    const s = lum <= 5 ? 1 : lum === 6 ? 0.7 : 0.42;
    const [r, g, b] = hsvToRgb(h, s, v);
    MASTER.push([Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]);
  }
}

/** Little-endian RGBA packed for ImageData's Uint32 view. */
export const MASTER32 = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  const [r, g, b] = MASTER[i];
  MASTER32[i] = (0xff << 24) | (b << 16) | (g << 8) | r;
}

/** Named hues (index into the 32-hue wheel). */
export const HUE = {
  GREY: 0, RED: 1, ORANGE: 3, AMBER: 4, YELLOW: 6, LIME: 8, GREEN: 11,
  TEAL: 14, CYAN: 16, AZURE: 18, BLUE: 22, INDIGO: 24, VIOLET: 25,
  MAGENTA: 27, PINK: 30, ROSE: 31,
} as const;
export type HueName = keyof typeof HUE;

/** Master colour index from a hue name and brightness 0..7. */
export function col(h: HueName, lum: number): number {
  return HUE[h] * LUMS + Math.max(0, Math.min(7, lum));
}

export const BLACK = 0;
export const WHITE = col('GREY', 7);

/** Pens: what the framebuffer stores. 32 per scanline. */
export const PEN = {
  BLACK: 0,
  STAR1: 1, STAR2: 2, STAR3: 3,
  WHITE: 4, HUD1: 5, HUD2: 6,
  PLAYER: 7, PLAYER2: 8, PLAYER3: 9,
  SHOT: 10, BOMB: 11, DART: 12,
  EA1: 13, EA2: 14, EA3: 15,
  EB1: 16, EB2: 17, EB3: 18,
  EC1: 19, EC2: 20, EC3: 21,
  FIELD: 22, BEAM: 23,
  CYC0: 24, CYC1: 25, CYC2: 26, CYC3: 27, CYC4: 28, CYC5: 29,
  FLASH: 30, FACE: 31,
} as const;
export type PenName = keyof typeof PEN;
export const PEN_COUNT = 32;
