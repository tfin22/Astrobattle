import type { Layout, Rect } from './layout';
import { BIG, SMALL } from '../content/font';
import { VORG_FACE } from '../content/sprites';
import { Rng } from '../core/rng';
import { GAME_TITLE, GAME_TAGLINE } from '../content/text';

/**
 * Cabinet side art for screens with no touchscreen and room either side of
 * the picture (monitors, laptops): a brick wall with the game's logo and a
 * keyboard controls card on the left, 80s graffiti on the right. Everything
 * is drawn here from code; nothing is loaded.
 */
export interface SideInfo {
  hiName: string;
  hiScore: number;
}

/** Minimum side width (CSS px) worth decorating. */
export const MIN_ART_CSS = 170;

export function sideArtPanels(l: Layout): { left: Rect; right: Rect } | null {
  if (l.mode !== 'none') return null;
  if (l.play.x / l.dpr < MIN_ART_CSS) return null;
  return {
    left: { x: 0, y: 0, w: l.play.x, h: l.devH },
    right: { x: l.play.x + l.play.w, y: 0, w: l.devW - l.play.x - l.play.w, h: l.devH },
  };
}

/**
 * How much each layer is dimmed (alpha over black) and desaturated (0..1).
 * Tuned so the walls sit near the game picture's own brightness and the
 * controls card stays easy to read.
 */
export const DIM = {
  wall: { alpha: 0.24, desaturate: 0.5 },
  logo: { alpha: 0.6, desaturate: 0.35 },
  card: { alpha: 0.85, desaturate: 0.3 },
  sign: 0.5,
};

const NEON_PINK = '#ff3d7f';
const NEON_CYAN = '#29e6ff';
const NEON_YELLOW = '#ffd23a';

export class SideArt {
  private cache: HTMLCanvasElement | null = null;
  private cacheKey = '';

  /**
   * Draw the art (cached) plus the neon sign. The sign blinks only while the
   * machine is idle (attract, menus); during play it stays lit and dim.
   */
  draw(ctx: CanvasRenderingContext2D, l: Layout, info: SideInfo, blinkOn: boolean): void {
    const panels = sideArtPanels(l);
    if (!panels) return;
    const key = `${l.devW}x${l.devH}|${l.play.x}|${info.hiName}|${info.hiScore}`;
    if (!this.cache || key !== this.cacheKey) {
      this.cache = this.render(l, panels, info);
      this.cacheKey = key;
    }
    ctx.drawImage(this.cache, 0, 0);
    ctx.save();
    ctx.globalAlpha = DIM.sign;
    this.neonSign(ctx, panels.right, blinkOn);
    ctx.restore();
  }

  /**
   * The art is drawn in three layers - the wall and its graffiti, the logo,
   * the controls card - then each is composited dimmed and desaturated by
   * its own amount (DIM), so the sides support the game rather than compete
   * with it. Baked into one cached canvas.
   */
  private render(l: Layout, p: { left: Rect; right: Rect }, info: SideInfo): HTMLCanvasElement {
    const layer = () => {
      const c = document.createElement('canvas');
      c.width = l.devW;
      c.height = l.devH;
      return c;
    };
    const rng = new Rng(1981);
    const clipped = (x: CanvasRenderingContext2D, r: Rect, fn: () => void) => {
      x.save();
      x.beginPath();
      x.rect(r.x, r.y, r.w, r.h);
      x.clip();
      fn();
      x.restore();
    };
    const wall = layer();
    const wx = wall.getContext('2d')!;
    clipped(wx, p.left, () => bricks(wx, p.left, rng));
    clipped(wx, p.right, () => {
      bricks(wx, p.right, rng);
      this.rightPanel(wx, p.right, info, rng);
    });
    const logo = layer();
    const lx = logo.getContext('2d')!;
    clipped(lx, p.left, () => this.logo(lx, p.left));
    const card = layer();
    const cx = card.getContext('2d')!;
    clipped(cx, p.left, () => this.controlsCard(cx, p.left));

    const out = layer();
    const x = out.getContext('2d')!;
    x.fillStyle = '#000';
    x.fillRect(0, 0, l.devW, l.devH);
    for (const [c, d] of [[wall, DIM.wall], [logo, DIM.logo], [card, DIM.card]] as const) {
      x.globalAlpha = d.alpha;
      x.drawImage(c, 0, 0);
      // Partial desaturation: blend grey in 'saturation' mode.
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'saturation';
      x.fillStyle = `rgba(128,128,128,${d.desaturate})`;
      for (const r of [p.left, p.right]) x.fillRect(r.x, r.y, r.w, r.h);
      x.globalCompositeOperation = 'source-over';
    }
    // Fade both walls into the picture's edge.
    for (const [r, dir] of [[p.left, 1], [p.right, -1]] as const) {
      const edge = dir > 0 ? r.x + r.w : r.x;
      const g = x.createLinearGradient(edge, 0, edge - dir * r.w * 0.3, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.9)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(dir > 0 ? edge - r.w * 0.3 : edge, 0, r.w * 0.3, r.h);
    }
    return out;
  }

  private logo(x: CanvasRenderingContext2D, r: Rect): void {
    const u = unit(r);
    const cx = r.x + r.w / 2;
    // Chunky pixel letters, chrome-to-neon, with a glow.
    pixelLogo(x, GAME_TITLE, cx, r.y + r.h * 0.07, Math.min(r.w * 0.82, 420 * u));
    pixelText(x, GAME_TAGLINE, cx, r.y + r.h * 0.07 + r.w * 0.82 * (7 / textWidthUnits(GAME_TITLE, BIG)) + 26 * u, 3 * u, NEON_CYAN, SMALL);
  }

  private controlsCard(x: CanvasRenderingContext2D, r: Rect): void {
    const u = unit(r);
    const cx = r.x + r.w / 2;
    // The controls card, like the instructions on a control panel.
    const cw = Math.min(r.w * 0.86, 400 * u);
    const ch = 318 * u;
    const top = Math.max(r.y + r.h * 0.34, r.y + r.h - ch - 40 * u);
    const left = cx - cw / 2;
    x.save();
    x.shadowColor = NEON_CYAN;
    x.shadowBlur = 8 * u;
    roundRect(x, left, top, cw, ch, 14 * u);
    x.fillStyle = 'rgba(10,6,20,0.92)';
    x.fill();
    x.restore();
    x.lineWidth = 3 * u;
    x.strokeStyle = NEON_CYAN;
    roundRect(x, left, top, cw, ch, 14 * u);
    x.stroke();
    x.lineWidth = 1.5 * u;
    x.strokeStyle = NEON_PINK;
    roundRect(x, left + 6 * u, top + 6 * u, cw - 12 * u, ch - 12 * u, 10 * u);
    x.stroke();
    pixelText(x, 'CONTROLS', cx, top + 22 * u, 4 * u, NEON_YELLOW, BIG, 0.7);
    const rows: [string[], string][] = [
      [['←', '→', '↑', '↓'], 'MOVE'],
      [['W', 'A', 'S', 'D'], 'MOVE'],
      [['SPACE', 'Z', 'ENTER'], 'FIRE'],
      [['P'], 'PAUSE'],
    ];
    let y = top + 70 * u;
    for (const [keys, what] of rows) {
      let kx = left + 26 * u;
      for (const k of keys) kx = keycap(x, k, kx, y, u) + 6 * u;
      x.fillStyle = '#f2ecff';
      x.font = `bold ${Math.round(17 * u)}px "Courier New", monospace`;
      x.textBaseline = 'middle';
      x.textAlign = 'right';
      x.fillText(what, left + cw - 24 * u, y + 15 * u);
      y += 40 * u;
    }
    x.fillStyle = NEON_PINK;
    x.font = `bold ${Math.round(13 * u)}px "Courier New", monospace`;
    x.textAlign = 'center';
    x.fillText('FIRE ALSO SELECTS AND INSERTS COINS', cx, y + 4 * u);
    x.fillText('FIRE AGAIN TO CANCEL YOUR SHOT', cx, y + 24 * u);
    x.fillStyle = '#9ad8ff';
    x.fillText('GAMEPAD: STICK MOVES, ANY BUTTON FIRES', cx, y + 52 * u);
  }

  private rightPanel(x: CanvasRenderingContext2D, r: Rect, info: SideInfo, rng: Rng): void {
    const u = unit(r);
    const W = r.w;
    const at = (fx: number, fy: number) => [r.x + W * fx, r.y + r.h * fy] as const;
    // Big throw-up.
    let [gx, gy] = at(0.5, 0.17);
    graffiti(x, 'VORG', gx, gy, Math.min(W * 0.3, 150 * u), -0.12, ['#ff6ad5', '#b10f7a'], rng);
    [gx, gy] = at(0.54, 0.27);
    graffiti(x, 'WAS HERE', gx, gy, Math.min(W * 0.11, 56 * u), -0.1, ['#fff27a', '#ff9d00'], rng);
    // A Liverpool nod.
    [gx, gy] = at(0.32, 0.46);
    graffiti(x, 'KOP END', gx, gy, Math.min(W * 0.12, 60 * u), 0.08, ['#ff4a4a', '#b00010'], rng);
    [gx, gy] = at(0.7, 0.6);
    graffiti(x, 'GAME ON!', gx, gy, Math.min(W * 0.1, 50 * u), -0.05, ['#7affff', '#008ec4'], rng);
    // VORG sticker.
    [gx, gy] = at(0.75, 0.42);
    sticker(x, gx, gy, Math.max(2, Math.round(Math.min(W * 0.006, 4 * u) * 2) / 2), 0.14);
    // High score, chalk-style.
    [gx, gy] = at(0.36, 0.72);
    x.save();
    x.translate(gx, gy);
    x.rotate(-0.04);
    pixelText(x, 'HIGH SCORE', 0, 0, 3.4 * u, '#ffffff', BIG, 0.9);
    pixelText(x, `${info.hiName}  ${String(info.hiScore).padStart(6, '0')}`, 0, 34 * u, 3.4 * u, NEON_YELLOW, BIG, 1);
    x.restore();
    // Small tags and doodles.
    [gx, gy] = at(0.2, 0.6);
    graffiti(x, 'LFC', gx, gy, Math.min(W * 0.08, 40 * u), -0.2, ['#ff4a4a', '#9a0010'], rng);
    [gx, gy] = at(0.28, 0.355);
    scribble(x, '1981 → 2026', gx, gy, 18 * u, -0.06, '#c9b6ff');
    [gx, gy] = at(0.84, 0.665);
    scribble(x, 'AAM #1', gx, gy, 20 * u, 0.12, NEON_YELLOW);
    for (let i = 0; i < 14; i++) star(x, r.x + rng.range(0.05, 0.95) * W, r.y + rng.range(0.03, 0.97) * r.h, rng.range(3, 7) * u, rng.pick([NEON_PINK, NEON_CYAN, NEON_YELLOW]));
  }

  /** The blinking INSERT COIN neon sign (drawn every few hundred ms). */
  private neonSign(x: CanvasRenderingContext2D, r: Rect, on: boolean): void {
    const u = unit(r);
    const w = Math.min(r.w * 0.7, 300 * u);
    const h = 64 * u;
    const cx = r.x + r.w * 0.5;
    const cy = r.y + r.h * 0.95 - h;
    x.save();
    roundRect(x, cx - w / 2, cy - h / 2, w, h, 12 * u);
    x.fillStyle = 'rgba(8,4,14,0.9)';
    x.fill();
    x.lineWidth = 3 * u;
    x.strokeStyle = on ? NEON_PINK : '#4a1830';
    if (on) {
      x.shadowColor = NEON_PINK;
      x.shadowBlur = 20 * u;
    }
    x.stroke();
    x.font = `bold ${Math.round(30 * u)}px "Courier New", monospace`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = on ? '#ffe6f1' : '#5a2a40';
    x.fillText('INSERT COIN', cx, cy + 2 * u);
    x.restore();
  }
}

// ---------------------------------------------------------------------------
// Drawing helpers

function unit(r: Rect): number {
  return Math.max(0.5, Math.min(r.w / 420, r.h / 760));
}

function roundRect(x: CanvasRenderingContext2D, l: number, t: number, w: number, h: number, rad: number): void {
  x.beginPath();
  x.moveTo(l + rad, t);
  x.arcTo(l + w, t, l + w, t + h, rad);
  x.arcTo(l + w, t + h, l, t + h, rad);
  x.arcTo(l, t + h, l, t, rad);
  x.arcTo(l, t, l + w, t, rad);
  x.closePath();
}

function bricks(x: CanvasRenderingContext2D, r: Rect, rng: Rng): void {
  const u = unit(r);
  const bh = 26 * u;
  const bw = 62 * u;
  x.fillStyle = '#06030a';
  x.fillRect(r.x, r.y, r.w, r.h);
  for (let row = 0, y = r.y; y < r.y + r.h; row++, y += bh) {
    const off = row % 2 ? bw / 2 : 0;
    for (let bx = r.x - off; bx < r.x + r.w; bx += bw) {
      const l = 7 + rng.range(0, 7);
      x.fillStyle = `hsl(${rng.range(318, 345)}, 28%, ${l}%)`;
      x.fillRect(bx + 1.5 * u, y + 1.5 * u, bw - 3 * u, bh - 3 * u);
    }
  }
  // Darken the wall top and bottom so the art reads.
  const g = x.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.1)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = g;
  x.fillRect(r.x, r.y, r.w, r.h);
}

function textWidthUnits(str: string, glyphs: Record<string, string[]>): number {
  let w = 0;
  for (const ch of str) w += (glyphs[ch] ?? glyphs['?'])[0].length + 1;
  return w - 1;
}

/** Text in the game's own pixel font, centred on cx, top at y. */
function pixelText(x: CanvasRenderingContext2D, str: string, cx: number, y: number, px: number, colour: string, glyphs: Record<string, string[]>, glow = 0.6): void {
  const w = textWidthUnits(str, glyphs) * px;
  let gx = cx - w / 2;
  x.save();
  x.fillStyle = colour;
  x.shadowColor = colour;
  x.shadowBlur = 10 * px * glow;
  for (const ch of str) {
    const g = glyphs[ch] ?? glyphs['?'];
    g.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) if (row[rx] === 'X') x.fillRect(gx + rx * px, y + ry * px, px * 0.9, px * 0.9);
    });
    gx += (g[0].length + 1) * px;
  }
  x.restore();
}

/** The marquee logo: pixel letters with an outline, chrome gradient and neon glow. */
function pixelLogo(x: CanvasRenderingContext2D, str: string, cx: number, y: number, width: number): void {
  const units = textWidthUnits(str, BIG);
  const px = width / units;
  const left = cx - width / 2;
  const cells: [number, number][] = [];
  let gx = 0;
  for (const ch of str) {
    const g = BIG[ch] ?? BIG['?'];
    g.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) if (row[rx] === 'X') cells.push([gx + rx, ry]);
    });
    gx += g[0].length + 1;
  }
  const at = (c: [number, number], d: number) => [left + c[0] * px - d, y + c[1] * px - d, px + 2 * d] as const;
  x.save();
  // Drop shadow, outline, then the chrome fill with a glow.
  x.fillStyle = '#000';
  for (const c of cells) {
    const [a, b, s] = at(c, 0);
    x.fillRect(a + px * 0.35, b + px * 0.35, s, s);
  }
  x.fillStyle = '#1a0526';
  for (const c of cells) {
    const [a, b, s] = at(c, px * 0.16);
    x.fillRect(a, b, s, s);
  }
  const g = x.createLinearGradient(0, y, 0, y + 7 * px);
  g.addColorStop(0, '#fffbd0');
  g.addColorStop(0.35, '#ffc21a');
  g.addColorStop(0.62, NEON_PINK);
  g.addColorStop(1, '#8a2bff');
  x.shadowColor = NEON_PINK;
  x.shadowBlur = px * 1.4;
  x.fillStyle = g;
  for (const c of cells) {
    const [a, b, s] = at(c, 0);
    x.fillRect(a, b, s * 0.94, s * 0.94);
  }
  x.restore();
}

function keycap(x: CanvasRenderingContext2D, label: string, left: number, top: number, u: number): number {
  x.font = `bold ${Math.round(15 * u)}px "Courier New", monospace`;
  const w = Math.max(30 * u, x.measureText(label).width + 16 * u);
  const h = 30 * u;
  roundRect(x, left, top + 3 * u, w, h, 5 * u);
  x.fillStyle = '#5e5868';
  x.fill();
  roundRect(x, left, top, w, h - 2 * u, 5 * u);
  x.fillStyle = '#b8b0c4';
  x.fill();
  x.fillStyle = '#1a1020';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(label, left + w / 2, top + h / 2 - 1 * u);
  return left + w;
}

/** A spray-painted tag: overspray, a white and a black outline, a two-tone fill and drips. */
function graffiti(x: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, rot: number, fill: [string, string], rng: Rng): void {
  x.save();
  x.translate(cx, cy);
  x.rotate(rot);
  x.font = `900 ${Math.round(size)}px Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'alphabetic';
  const w = x.measureText(text).width;
  // Overspray.
  x.fillStyle = fill[0];
  for (let i = 0; i < 160; i++) {
    x.globalAlpha = rng.range(0.05, 0.25);
    const r = rng.range(0.5, 2.2) * (size / 60);
    x.beginPath();
    x.arc(rng.range(-w * 0.6, w * 0.6), rng.range(-size * 0.95, size * 0.25), r, 0, Math.PI * 2);
    x.fill();
  }
  x.globalAlpha = 1;
  x.lineJoin = 'round';
  // 3D drop.
  x.fillStyle = '#000';
  x.fillText(text, size * 0.06, size * 0.07);
  x.lineWidth = size * 0.26;
  x.strokeStyle = '#ffffff';
  x.strokeText(text, 0, 0);
  x.lineWidth = size * 0.13;
  x.strokeStyle = '#120612';
  x.strokeText(text, 0, 0);
  const g = x.createLinearGradient(0, -size * 0.8, 0, 0);
  g.addColorStop(0, fill[0]);
  g.addColorStop(1, fill[1]);
  x.fillStyle = g;
  x.fillText(text, 0, 0);
  // Drips.
  x.strokeStyle = fill[1];
  x.lineCap = 'round';
  x.lineWidth = Math.max(1.5, size * 0.055);
  const n = 2 + rng.int(4);
  for (let i = 0; i < n; i++) {
    const dx = rng.range(-w * 0.45, w * 0.45);
    const len = rng.range(0.15, 0.55) * size;
    x.beginPath();
    x.moveTo(dx, -size * 0.05);
    x.lineTo(dx, len);
    x.stroke();
    x.beginPath();
    x.fillStyle = fill[1];
    x.arc(dx, len, x.lineWidth * 0.8, 0, Math.PI * 2);
    x.fill();
  }
  // Highlight glints.
  x.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 3; i++) {
    x.beginPath();
    x.arc(rng.range(-w * 0.4, w * 0.4), -size * rng.range(0.45, 0.7), size * 0.03, 0, Math.PI * 2);
    x.fill();
  }
  x.restore();
}

function scribble(x: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, rot: number, colour: string): void {
  x.save();
  x.translate(cx, cy);
  x.rotate(rot);
  x.font = `italic bold ${Math.round(size)}px "Comic Sans MS", "Marker Felt", "Trebuchet MS", sans-serif`;
  x.textAlign = 'center';
  x.fillStyle = colour;
  x.shadowColor = colour;
  x.shadowBlur = size * 0.4;
  x.fillText(text, 0, 0);
  x.restore();
}

function star(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, colour: string): void {
  x.save();
  x.strokeStyle = colour;
  x.shadowColor = colour;
  x.shadowBlur = r * 2;
  x.lineWidth = Math.max(1, r * 0.3);
  x.beginPath();
  x.moveTo(cx - r, cy);
  x.lineTo(cx + r, cy);
  x.moveTo(cx, cy - r);
  x.lineTo(cx, cy + r);
  x.stroke();
  x.restore();
}

/** VORG's face as a peeling sticker: white border, a slight tilt. */
function sticker(x: CanvasRenderingContext2D, cx: number, cy: number, px: number, rot: number): void {
  const rows = VORG_FACE.frames[0];
  const w = rows[0].length;
  const h = rows.length;
  const colours: Record<string, string> = { '1': '#bdbdcc', '2': '#6a2bd0', '3': NEON_YELLOW, '4': '#ff8a2a', '5': NEON_PINK, '6': '#000' };
  x.save();
  x.translate(cx, cy);
  x.rotate(rot);
  x.translate((-w * px) / 2, (-h * px) / 2);
  x.shadowColor = 'rgba(0,0,0,0.7)';
  x.shadowBlur = px * 3;
  x.shadowOffsetX = px;
  x.shadowOffsetY = px;
  x.fillStyle = '#ffffff';
  roundRect(x, -px * 3, -px * 3, (w + 6) * px, (h + 6) * px, px * 3);
  x.fill();
  x.shadowColor = 'transparent';
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const c = colours[row[rx]];
      if (!c) continue;
      x.fillStyle = c;
      x.fillRect(rx * px, ry * px, px, px);
    }
  });
  x.restore();
}
