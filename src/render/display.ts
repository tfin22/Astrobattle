import { FB_H, FB_W, type Framebuffer } from './framebuffer';
import { computeLayout, type Layout } from './layout';
import type { InputManager } from '../platform/input';
import { GAME_TITLE } from '../content/text';

/**
 * Puts the framebuffer on the real screen. The 204x320 picture lives in its
 * own small canvas that the browser's compositor scales up (integer-sized,
 * `image-rendering: pixelated`), which costs almost nothing on a phone. A
 * transparent canvas on top holds the thumb controls, bezel and debug
 * drawings, and is only redrawn when something on it changes.
 */
export class Display {
  /** The UI layer (controls, bezel, debug). Receives all touches. */
  readonly ctx: CanvasRenderingContext2D;
  /** The arcade picture, 204x320. */
  readonly off: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private image: ImageData;
  private buf32: Uint32Array;
  private glow: HTMLCanvasElement;
  private glowCtx: CanvasRenderingContext2D;
  private crtLayer: HTMLCanvasElement;
  layout!: Layout;
  crt = false;
  bezel = false;
  touch = false;
  /** Set when something outside the controls (debug) draws on the UI layer. */
  uiDirty = true;
  private uiKey = '';
  private panel: HTMLCanvasElement | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    const layer = (c: HTMLCanvasElement, z: number) => {
      c.style.position = 'fixed';
      c.style.zIndex = String(z);
      c.style.pointerEvents = 'none';
      canvas.parentElement!.insertBefore(c, canvas);
    };
    this.off = document.createElement('canvas');
    this.off.width = FB_W;
    this.off.height = FB_H;
    this.off.style.imageRendering = 'pixelated';
    layer(this.off, 0);
    this.offCtx = this.off.getContext('2d', { alpha: false })!;
    this.image = this.offCtx.createImageData(FB_W, FB_H);
    this.buf32 = new Uint32Array(this.image.data.buffer);
    // CRT bloom: a tiny copy, smoothed by the compositor and screened on top.
    this.glow = document.createElement('canvas');
    this.glow.width = FB_W / 4;
    this.glow.height = FB_H / 4;
    this.glow.style.mixBlendMode = 'screen';
    this.glow.style.imageRendering = 'auto';
    this.glow.style.opacity = '0.35';
    layer(this.glow, 1);
    this.glowCtx = this.glow.getContext('2d')!;
    // CRT scanlines and vignette: a static layer.
    this.crtLayer = document.createElement('canvas');
    layer(this.crtLayer, 2);
    canvas.style.zIndex = '3';
    this.resize();
  }

  resize(): void {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 4);
    const l = (this.layout = computeLayout(cssW, cssH, dpr, this.touch));
    this.canvas.width = l.devW;
    this.canvas.height = l.devH;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    for (const c of [this.off, this.glow, this.crtLayer]) {
      c.style.left = l.play.x / dpr + 'px';
      c.style.top = l.play.y / dpr + 'px';
      c.style.width = l.play.w / dpr + 'px';
      c.style.height = l.play.h / dpr + 'px';
    }
    this.buildCrtLayer();
    this.panel = null;
    this.uiDirty = true;
  }

  private buildCrtLayer(): void {
    const l = this.layout;
    const c = this.crtLayer;
    c.width = l.play.w;
    c.height = l.play.h;
    const x = c.getContext('2d')!;
    x.clearRect(0, 0, c.width, c.height);
    const step = Math.max(2, l.scale);
    const dark = Math.max(1, Math.floor(step / 3));
    x.fillStyle = 'rgba(0,0,0,0.38)';
    for (let y = 0; y < l.play.h; y += step) x.fillRect(0, Math.round(y + step - dark), l.play.w, dark);
    const g = x.createRadialGradient(l.play.w / 2, l.play.h / 2, l.play.h * 0.35, l.play.w / 2, l.play.h / 2, l.play.h * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    x.fillStyle = g;
    x.fillRect(0, 0, l.play.w, l.play.h);
  }

  present(fb: Framebuffer, input: InputManager | null, showControls: boolean): void {
    fb.toRGBA(this.buf32);
    this.offCtx.putImageData(this.image, 0, 0);
    const crt = this.crt ? '' : 'none';
    if (this.glow.style.display !== crt) {
      this.glow.style.display = crt;
      this.crtLayer.style.display = crt;
      this.off.style.borderRadius = this.crt ? '3%' : '0';
    }
    if (this.crt) {
      this.glowCtx.imageSmoothingEnabled = true;
      this.glowCtx.drawImage(this.off, 0, 0, this.glow.width, this.glow.height);
    }
    // The UI layer: only redraw when its contents change.
    const s = input?.stick;
    const key = input
      ? `${s!.active ? 1 : 0}${Math.round(s!.ox)},${Math.round(s!.oy)},${Math.round(s!.kx)},${Math.round(s!.ky)}|${input.firePressedVisual ? 1 : 0}|${input.dpadMode ? 1 : 0}|${showControls ? 1 : 0}|${this.bezel ? 1 : 0}`
      : 'none';
    if (!this.uiDirty && key === this.uiKey) return;
    this.uiKey = key;
    this.uiDirty = false;
    const { ctx, layout: l } = this;
    ctx.clearRect(0, 0, l.devW, l.devH);
    if (this.bezel) this.drawBezel();
    if (l.controls.h > 0 && input) this.drawControls(input, showControls);
  }

  private drawBezel(): void {
    const { ctx, layout: l } = this;
    const side = l.play.x;
    const top = l.play.y;
    if (side < 4 && top < 4) {
      // Thin trim only when there's no margin to fill.
    }
    const grad = ctx.createLinearGradient(0, 0, l.devW, 0);
    grad.addColorStop(0, '#120a1e');
    grad.addColorStop(0.5, '#05030a');
    grad.addColorStop(1, '#120a1e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, l.devW, l.play.y + l.play.h);
    ctx.clearRect(l.play.x, l.play.y, l.play.w, l.play.h);
    const t = Math.max(2, Math.round(l.dpr * 2));
    ctx.fillStyle = '#e0306a';
    ctx.fillRect(l.play.x - t * 2, l.play.y, t, l.play.h);
    ctx.fillRect(l.play.x + l.play.w + t, l.play.y, t, l.play.h);
    ctx.fillStyle = '#29c6e0';
    ctx.fillRect(l.play.x - t * 4, l.play.y, t, l.play.h);
    ctx.fillRect(l.play.x + l.play.w + t * 3, l.play.y, t, l.play.h);
    if (top > 40 * l.dpr) {
      // Marquee above the picture (desktop / tall screens).
      const mh = Math.min(top - 8 * l.dpr, 70 * l.dpr);
      const my = top - mh - 4 * l.dpr;
      const mg = ctx.createLinearGradient(0, my, 0, my + mh);
      mg.addColorStop(0, '#3a0a4a');
      mg.addColorStop(1, '#0a0420');
      ctx.fillStyle = mg;
      ctx.fillRect(l.play.x, my, l.play.w, mh);
      ctx.fillStyle = '#ffd23a';
      ctx.font = `bold ${Math.round(mh * 0.42)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(GAME_TITLE, l.play.x + l.play.w / 2, my + mh / 2);
    }
  }

  private drawControls(input: InputManager, show: boolean): void {
    const { ctx, layout: l } = this;
    const c = l.controls;
    const d = l.dpr;
    // The control panel background, cached.
    if (!this.panel) {
      const p = document.createElement('canvas');
      p.width = c.w;
      p.height = c.h;
      const x = p.getContext('2d')!;
      const g = x.createLinearGradient(0, 0, 0, c.h);
      g.addColorStop(0, '#16101f');
      g.addColorStop(1, '#07050b');
      x.fillStyle = g;
      x.fillRect(0, 0, c.w, c.h);
      x.fillStyle = '#e0306a';
      x.fillRect(0, 0, c.w, Math.max(1, Math.round(d * 1.5)));
      this.panel = p;
    }
    ctx.drawImage(this.panel, c.x, c.y);
    if (!show) return;

    // Stick (or d-pad).
    ctx.save();
    if (input.dpadMode) {
      const p = l.dpad;
      const arm = p.r * 0.36;
      ctx.fillStyle = '#2a2236';
      ctx.fillRect(p.x - arm, p.y - p.r, arm * 2, p.r * 2);
      ctx.fillRect(p.x - p.r, p.y - arm, p.r * 2, arm * 2);
      if (input.stick.active) {
        const dx = input.stick.kx - p.x;
        const dy = input.stick.ky - p.y;
        ctx.fillStyle = '#5ad1ff';
        ctx.beginPath();
        const len = Math.hypot(dx, dy) || 1;
        const k = Math.min(len, p.r * 0.7);
        ctx.arc(p.x + (dx / len) * k, p.y + (dy / len) * k, arm * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (input.stick.active) {
      const s = input.stick;
      ctx.strokeStyle = 'rgba(90,209,255,0.5)';
      ctx.lineWidth = 3 * d;
      ctx.beginPath();
      ctx.arc(s.ox, s.oy, 46 * d, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#5ad1ff';
      ctx.beginPath();
      ctx.arc(s.kx, s.ky, 20 * d, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const x = l.stickZone.x + l.stickZone.w * 0.45;
      const y = l.fire.y;
      ctx.strokeStyle = 'rgba(90,209,255,0.22)';
      ctx.lineWidth = 2 * d;
      ctx.beginPath();
      ctx.arc(x, y, 46 * d, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(90,209,255,0.35)';
      ctx.font = `bold ${Math.round(12 * d)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MOVE', x, y);
    }
    // Fire button.
    const f = l.fire;
    const pressed = input.firePressedVisual;
    ctx.fillStyle = '#3a0612';
    ctx.beginPath();
    ctx.arc(f.x, f.y + 5 * d, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pressed ? '#a0102c' : '#e3203f';
    ctx.beginPath();
    ctx.arc(f.x, f.y + (pressed ? 4 * d : 0), f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(f.x - f.r * 0.25, f.y - f.r * 0.3 + (pressed ? 4 * d : 0), f.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9ef';
    ctx.font = `bold ${Math.round(f.r * 0.36)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FIRE', f.x, f.y + (pressed ? 4 * d : 0));
    ctx.restore();
  }
}
