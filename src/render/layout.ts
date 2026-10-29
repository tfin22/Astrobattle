import { FB_H, FB_W } from './framebuffer';

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  cssW: number;
  cssH: number;
  dpr: number;
  /** Canvas size in device pixels. */
  devW: number;
  devH: number;
  /** Device pixels per game pixel. */
  scale: number;
  integer: boolean;
  play: Rect;
  controls: Rect;
  stickZone: Rect;
  fireZone: Rect;
  fire: { x: number; y: number; r: number };
  /** Centre used by the fixed d-pad. */
  dpad: { x: number; y: number; r: number };
}

/** Minimum height of the thumb area below the picture, in CSS pixels. */
export const MIN_CONTROLS_CSS = 180;

/**
 * Portrait layout: the arcade picture on top, as large as fits, and the
 * thumb controls below it so they never cover play.
 *
 * By default the picture fills the space (nearest-neighbour at a fractional
 * scale: on a phone's dense screen the odd uneven pixel is invisible, and
 * sprites come out ~15% bigger). `sharp` keeps whole-number scaling, every
 * pixel exactly square, wherever that doesn't waste much.
 */
export function computeLayout(cssW: number, cssH: number, dpr: number, touch: boolean, sharp = false): Layout {
  const devW = Math.max(1, Math.round(cssW * dpr));
  const devH = Math.max(1, Math.round(cssH * dpr));
  const ctrlCss = touch ? Math.max(MIN_CONTROLS_CSS, cssH * 0.26) : 0;
  const availH = Math.max(FB_H, devH - ctrlCss * dpr);
  const fit = Math.min(devW / FB_W, availH / FB_H);
  let scale = Math.floor(fit);
  let integer = true;
  // Whole numbers only when asked for (and they fit well), or when the
  // whole number is already within 2% of filling the space.
  const keepInteger = sharp ? scale / fit >= 0.86 : scale / fit >= 0.98;
  if (scale < 1 || !keepInteger) {
    scale = fit;
    integer = false;
  }
  const pw = Math.floor(FB_W * scale);
  const ph = Math.floor(FB_H * scale);
  const px = Math.floor((devW - pw) / 2);
  const py = touch ? 0 : Math.floor((devH - ph) / 2);
  const play = { x: px, y: py, w: pw, h: ph };
  const controls = touch
    ? { x: 0, y: ph, w: devW, h: devH - ph }
    : { x: 0, y: devH, w: devW, h: 0 };
  const split = Math.round(devW * 0.55);
  const stickZone = { x: 0, y: controls.y, w: split, h: controls.h };
  const fireZone = { x: split, y: controls.y, w: devW - split, h: controls.h };
  const fr = Math.min(controls.h * 0.3, devW * 0.16);
  const fire = { x: Math.round(devW * 0.78), y: Math.round(controls.y + controls.h * 0.5), r: Math.round(fr) };
  const dpad = { x: Math.round(devW * 0.25), y: fire.y, r: Math.round(Math.min(controls.h * 0.34, devW * 0.2)) };
  return { cssW, cssH, dpr, devW, devH, scale, integer, play, controls, stickZone, fireZone, fire, dpad };
}

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

/** Device-pixel point to framebuffer coordinates (may be outside). */
export function toGame(l: Layout, x: number, y: number): { x: number; y: number } {
  return { x: (x - l.play.x) / l.scale, y: (y - l.play.y) / l.scale };
}
