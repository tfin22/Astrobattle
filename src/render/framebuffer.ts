import { PEN_COUNT } from '../palette';
import { BIG, SMALL, type Glyphs } from '../content/font';
import type { SpriteDef } from '../content/sprites/types';

export const FB_W = 204;
export const FB_H = 320;

export type FontName = 'big' | 'small';

/**
 * Indexed-colour framebuffer. Each byte is a pen (0..31); the pen means a
 * different colour on every scanline (see palette.ts / render/colours.ts).
 */
export class Framebuffer {
  readonly w = FB_W;
  readonly h = FB_H;
  readonly px = new Uint8Array(FB_W * FB_H);
  /** pen -> RGBA per scanline: FB_H * PEN_COUNT entries. */
  readonly lineMap = new Uint32Array(FB_H * PEN_COUNT);

  clear(pen = 0): void {
    this.px.fill(pen);
  }

  pset(x: number, y: number, pen: number): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= FB_W || y >= FB_H) return;
    this.px[y * FB_W + x] = pen;
  }

  get(x: number, y: number): number {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= FB_W || y >= FB_H) return 0;
    return this.px[y * FB_W + x];
  }

  rect(x: number, y: number, w: number, h: number, pen: number): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(FB_W, Math.round(x + w));
    const y1 = Math.min(FB_H, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) {
      const row = yy * FB_W;
      for (let xx = x0; xx < x1; xx++) this.px[row + xx] = pen;
    }
  }

  frame(x: number, y: number, w: number, h: number, pen: number): void {
    this.rect(x, y, w, 1, pen);
    this.rect(x, y + h - 1, w, 1, pen);
    this.rect(x, y, 1, h, pen);
    this.rect(x + w - 1, y, 1, h, pen);
  }

  line(x0: number, y0: number, x1: number, y1: number, pen: number): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 2000; n++) {
      this.pset(x0, y0, pen);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /**
   * Draw a sprite frame centred on (cx, cy). Digits '1'..'9' in the sprite
   * map to pens[0..8]; '.' is transparent. `scale` is an integer.
   */
  sprite(def: SpriteDef, frame: number, cx: number, cy: number, pens: readonly number[], scale = 1, flipX = false): void {
    const rows = def.frames[frame % def.frames.length];
    const h = rows.length;
    const w = rows[0].length;
    const ox = Math.round(cx - (w * scale) / 2);
    const oy = Math.round(cy - (h * scale) / 2);
    for (let r = 0; r < h; r++) {
      const row = rows[r];
      for (let c = 0; c < w; c++) {
        const ch = row.charCodeAt(flipX ? w - 1 - c : c);
        if (ch < 49 || ch > 57) continue; // not '1'..'9'
        const pen = pens[ch - 49] ?? pens[0];
        if (scale === 1) this.pset(ox + c, oy + r, pen);
        else this.rect(ox + c * scale, oy + r * scale, scale, scale, pen);
      }
    }
  }

  /** Draw text; returns the width in pixels. */
  text(str: string, x: number, y: number, pen: number, font: FontName = 'big', scale = 1): number {
    const glyphs = font === 'big' ? BIG : SMALL;
    let cx = Math.round(x);
    for (const raw of str) {
      const ch = raw.toUpperCase();
      const g = glyphs[ch] ?? glyphs['?'];
      for (let r = 0; r < g.length; r++) {
        const row = g[r];
        for (let c = 0; c < row.length; c++) {
          if (row[c] !== 'X') continue;
          if (scale === 1) this.pset(cx + c, y + r, pen);
          else this.rect(cx + c * scale, y + r * scale, scale, scale, pen);
        }
      }
      cx += (g[0].length + 1) * scale;
    }
    return cx - Math.round(x) - scale;
  }

  textCentered(str: string, cx: number, y: number, pen: number, font: FontName = 'big', scale = 1): void {
    const w = textWidth(str, font) * scale;
    this.text(str, Math.round(cx - w / 2), y, pen, font, scale);
  }

  /** Convert pens to RGBA through the per-scanline map. */
  toRGBA(out: Uint32Array): void {
    const px = this.px;
    const map = this.lineMap;
    let i = 0;
    for (let y = 0; y < FB_H; y++) {
      const base = y * PEN_COUNT;
      for (let x = 0; x < FB_W; x++, i++) out[i] = map[base + px[i]];
    }
  }
}

export function textWidth(str: string, font: FontName = 'big'): number {
  const glyphs: Glyphs = font === 'big' ? BIG : SMALL;
  let w = 0;
  for (const raw of str) {
    const g = glyphs[raw.toUpperCase()] ?? glyphs['?'];
    w += g[0].length + 1;
  }
  return Math.max(0, w - 1);
}

/** Word-wrap text to a pixel width. */
export function wrapText(str: string, maxW: number, font: FontName = 'big'): string[] {
  const words = str.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (textWidth(next, font) <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
