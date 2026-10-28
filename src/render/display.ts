import { FB_H, FB_W, type Framebuffer } from './framebuffer';
import { computeLayout, type Layout } from './layout';
import type { InputManager } from '../platform/input';

/**
 * Puts the framebuffer on the real screen: integer-scaled, nearest
 * neighbour, letterboxed, with the thumb controls drawn underneath.
 */
export class Display {
  readonly ctx: CanvasRenderingContext2D;
  readonly off: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private image: ImageData;
  private buf32: Uint32Array;
  private glow: HTMLCanvasElement;
  private glowCtx: CanvasRenderingContext2D;
  private scanPattern: CanvasPattern | null = null;
  layout!: Layout;
  crt = false;
  bezel = false;
  touch = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.off = document.createElement('canvas');
    this.off.width = FB_W;
    this.off.height = FB_H;
    this.offCtx = this.off.getContext('2d')!;
    this.image = this.offCtx.createImageData(FB_W, FB_H);
    this.buf32 = new Uint32Array(this.image.data.buffer);
    this.glow = document.createElement('canvas');
    this.glow.width = FB_W / 4;
    this.glow.height = FB_H / 4;
    this.glowCtx = this.glow.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 4);
    this.layout = computeLayout(cssW, cssH, dpr, this.touch);
    this.canvas.width = this.layout.devW;
    this.canvas.height = this.layout.devH;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.scanPattern = null;
  }

  present(fb: Framebuffer, input: InputManager | null, showControls: boolean): void {
    const { ctx, layout: l } = this;
    fb.toRGBA(this.buf32);
    this.offCtx.putImageData(this.image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, l.devW, l.devH);
    if (this.bezel) this.drawBezel();
    ctx.drawImage(this.off, l.play.x, l.play.y, l.play.w, l.play.h);
    if (this.crt) this.drawCrt();
    if (l.controls.h > 0 && input) this.drawControls(input, showControls);
  }

  private drawCrt(): void {
    const { ctx, layout: l } = this;
    // Bloom: a blurred, brightened copy added on top.
    this.glowCtx.imageSmoothingEnabled = true;
    this.glowCtx.clearRect(0, 0, this.glow.width, this.glow.height);
    this.glowCtx.drawImage(this.off, 0, 0, this.glow.width, this.glow.height);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22;
    ctx.drawImage(this.glow, l.play.x, l.play.y, l.play.w, l.play.h);
    ctx.restore();
    // Scanlines: one dark line per arcade row.
    if (!this.scanPattern) {
      const h = Math.max(2, Math.round(l.scale));
      const p = document.createElement('canvas');
      p.width = 1;
      p.height = h;
      const pc = p.getContext('2d')!;
      pc.fillStyle = 'rgba(0,0,0,0.38)';
      pc.fillRect(0, h - Math.max(1, Math.floor(h / 3)), 1, Math.max(1, Math.floor(h / 3)));
      this.scanPattern = ctx.createPattern(p, 'repeat');
    }
    ctx.save();
    ctx.translate(l.play.x, l.play.y);
    ctx.fillStyle = this.scanPattern!;
    ctx.fillRect(0, 0, l.play.w, l.play.h);
    // A hint of curvature: darker, rounded corners.
    const g = ctx.createRadialGradient(l.play.w / 2, l.play.h / 2, l.play.h * 0.35, l.play.w / 2, l.play.h / 2, l.play.h * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, l.play.w, l.play.h);
    ctx.restore();
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
      ctx.fillText('QUANTUM CADET', l.play.x + l.play.w / 2, my + mh / 2);
    }
  }

  private drawControls(input: InputManager, show: boolean): void {
    const { ctx, layout: l } = this;
    const c = l.controls;
    const d = l.dpr;
    // The control panel.
    const g = ctx.createLinearGradient(0, c.y, 0, c.y + c.h);
    g.addColorStop(0, '#16101f');
    g.addColorStop(1, '#07050b');
    ctx.fillStyle = g;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = '#e0306a';
    ctx.fillRect(c.x, c.y, c.w, Math.max(1, Math.round(d * 1.5)));
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
