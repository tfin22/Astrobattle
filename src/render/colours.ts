import { MASTER32, PEN, PEN_COUNT } from '../palette';
import type { Look } from '../content/looks';
import { FB_H } from './framebuffer';

export interface ColourOverrides {
  /** Whole-screen flash: the black pen shows this master colour. */
  flash?: number;
  /** Extra per-pen overrides applied to every line. */
  pens?: Partial<Record<number, number>>;
}

/** Build the per-scanline pen -> RGBA table for one frame. */
export function buildLineMap(out: Uint32Array, look: Look, frame: number, ov: ColourOverrides = {}): void {
  const base = new Uint32Array(PEN_COUNT);
  for (const [name, c] of Object.entries(look.base)) base[PEN[name as keyof typeof PEN]] = MASTER32[c as number];
  if (look.cycles) {
    for (const cy of look.cycles) {
      const step = Math.floor(frame / cy.frames);
      cy.pens.forEach((p, i) => {
        base[PEN[p]] = MASTER32[cy.colours[(i + step) % cy.colours.length]];
      });
    }
  }
  if (ov.flash !== undefined) base[0] = MASTER32[ov.flash];

  for (let y = 0; y < FB_H; y++) out.set(base, y * PEN_COUNT);

  if (look.bands) {
    for (const b of look.bands) {
      for (let y = Math.max(0, b.y0); y < Math.min(FB_H, b.y1); y++) {
        for (const [name, c] of Object.entries(b.pens)) out[y * PEN_COUNT + PEN[name as keyof typeof PEN]] = MASTER32[c as number];
      }
    }
  }
  if (look.gradients) {
    for (const g of look.gradients) {
      const pen = PEN[g.pen];
      const off = Math.floor(frame * (g.scroll ?? 0));
      for (let y = Math.max(0, g.y0); y < Math.min(FB_H, g.y1); y++) {
        const i = Math.floor((y - g.y0 - off) / g.lines);
        const n = g.colours.length;
        out[y * PEN_COUNT + pen] = MASTER32[g.colours[((i % n) + n) % n]];
      }
    }
  }
  if (ov.pens) {
    for (const [p, c] of Object.entries(ov.pens)) {
      const v = MASTER32[c as number];
      for (let y = 0; y < FB_H; y++) out[y * PEN_COUNT + Number(p)] = v;
    }
  }
}
