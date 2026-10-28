import type { App } from '../app';
import type { Display } from '../render/display';
import { FB_W, type Framebuffer } from '../render/framebuffer';
import { ALL_SPRITES } from '../content/sprites';
import { MISSIONS } from '../content/missions';
import { RANKS } from '../content/ranks';
import { allLines } from '../content/speech';
import { PEN } from '../palette';
import { TUNING } from '../tuning';

/**
 * Debug overlay: 3-finger tap or Shift+D. FPS, sprite count, hitboxes,
 * enemy state labels, invincibility, skip to any mission at any rank,
 * trigger any VORG line, a sprite viewer and the seed.
 */
export class DebugOverlay {
  visible = false;
  hitboxes = true;
  labels = true;
  spriteViewer = false;
  spritePage = 0;
  frozen = false;
  /** Ask for one more clean redraw of the UI layer after closing. */
  justClosed = false;
  private panel: HTMLDivElement | null = null;
  private info: HTMLDivElement | null = null;

  constructor(private app: App) {}

  toggle(): void {
    this.visible = !this.visible;
    if (this.visible) this.open();
    else this.close();
  }

  private open(): void {
    if (this.panel) {
      this.panel.style.display = 'block';
      return;
    }
    const p = document.createElement('div');
    p.style.cssText =
      'position:fixed;left:4px;bottom:4px;z-index:10;background:rgba(10,0,20,0.86);color:#9ef;font:11px monospace;padding:6px;border:1px solid #e0306a;max-width:280px;';
    const info = document.createElement('div');
    info.style.cssText = 'white-space:pre;margin-bottom:4px;color:#fd6';
    p.appendChild(info);
    const row = () => {
      const d = document.createElement('div');
      d.style.cssText = 'margin:3px 0;display:flex;gap:4px;flex-wrap:wrap;align-items:center';
      p.appendChild(d);
      return d;
    };
    const btn = (parent: HTMLElement, label: string, fn: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'font:11px monospace;background:#302040;color:#fff;border:1px solid #888;padding:3px 6px';
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        fn();
      });
      parent.appendChild(b);
      return b;
    };
    const check = (parent: HTMLElement, label: string, get: () => boolean, set: (v: boolean) => void) => {
      const l = document.createElement('label');
      const c = document.createElement('input');
      c.type = 'checkbox';
      c.checked = get();
      c.addEventListener('change', () => set(c.checked));
      l.append(c, ' ' + label);
      parent.appendChild(l);
    };
    const r1 = row();
    check(r1, 'hitboxes', () => this.hitboxes, (v) => (this.hitboxes = v));
    check(r1, 'states', () => this.labels, (v) => (this.labels = v));
    check(r1, 'invincible', () => !!this.app.game?.invincible, (v) => {
      if (this.app.game) this.app.game.invincible = v;
    });
    const r2 = row();
    const ms = document.createElement('select');
    MISSIONS.forEach((m, i) => ms.add(new Option(`${i + 1} ${m.name}`, String(i))));
    const rs = document.createElement('select');
    for (let i = 0; i < RANKS.length + 2; i++) rs.add(new Option(i < RANKS.length ? RANKS[i].short : `ADMIRAL x${i - RANKS.length + 2}`, String(i)));
    r2.append(ms, rs);
    btn(r2, 'go', () => this.app.startGame('arcade', Number(ms.value), Number(rs.value)));
    const r3 = row();
    const ls = document.createElement('select');
    ls.style.maxWidth = '200px';
    allLines().forEach((l) => ls.add(new Option(`${l.trigger}: ${l.line.text}`, `${l.trigger}|${l.index}`)));
    r3.append(ls);
    btn(r3, 'say', () => {
      const [t, i] = ls.value.split('|');
      const g = this.app.game;
      if (g && this.app.screen === 'game') {
        g.vorg.sayLine(t, Number(i), g.frame, g.level);
        this.app.audio.say(g.vorg.current!.ph);
      } else {
        this.app.appVorg.sayLine(t, Number(i), this.app.frame, 0);
      }
    });
    const r4 = row();
    btn(r4, 'sprites', () => (this.spriteViewer = !this.spriteViewer));
    btn(r4, 'next', () => this.spritePage++);
    btn(r4, 'freeze', () => (this.frozen = !this.frozen));
    btn(r4, 'close', () => this.toggle());
    this.panel = p;
    this.info = info;
    document.body.appendChild(p);
  }

  private close(): void {
    this.justClosed = true;
    if (this.panel) this.panel.style.display = 'none';
    this.spriteViewer = false;
    this.frozen = false;
  }

  /** Sprite viewer draws into the arcade picture itself. */
  drawInFramebuffer(fb: Framebuffer): void {
    if (!this.visible || !this.spriteViewer) return;
    fb.clear(PEN.BLACK);
    fb.textCentered('SPRITE VIEWER', FB_W / 2, 4, PEN.HUD2, 'small');
    const pens = [PEN.WHITE, PEN.HUD2, PEN.HUD1, PEN.CYC0, PEN.PLAYER, PEN.BLACK];
    let x = 4;
    let y = 16;
    let rowH = 0;
    const per = 6;
    const start = (this.spritePage * per) % ALL_SPRITES.length;
    for (let i = 0; i < per && start + i < ALL_SPRITES.length; i++) {
      const s = ALL_SPRITES[start + i];
      const w = s.frames[0][0].length;
      const h = s.frames[0].length;
      const scale = w > 40 ? 1 : 2;
      const totalW = s.frames.length * (w * scale + 3);
      if (x + totalW > FB_W - 4) {
        x = 4;
        y += rowH + 12;
        rowH = 0;
      }
      fb.text(s.name, x, y, PEN.HUD1, 'small');
      s.frames.forEach((_, f) => fb.sprite(s, f, x + f * (w * scale + 3) + (w * scale) / 2, y + 8 + (h * scale) / 2, pens, scale));
      x += totalW + 6;
      rowH = Math.max(rowH, h * scale + 8);
    }
  }

  /** Hitboxes, state labels and the info panel, over the scaled picture. */
  drawOnScreen(d: Display): void {
    if (!this.visible) return;
    const app = this.app;
    const g = app.screen === 'game' ? app.game : null;
    if (this.info) {
      const sprites = g ? g.enemies.length + g.bullets.length + g.particles.length + (g.shot.alive ? 2 : 1) : 0;
      this.info.textContent =
        `FPS ${app.loop.fps.toFixed(0)}  sprites ${sprites}\n` +
        (g
          ? `seed ${g.opts.seed}  frame ${g.frame}\nmission ${g.missionIndex + 1} ${g.phase}  level ${g.level}\n` +
            `shots ${g.stats.shotsFired} cancels ${g.stats.cancels} hits ${g.stats.hits}`
          : `screen ${app.screen}`);
    }
    if (!g || this.spriteViewer) return;
    const { ctx, layout: l } = d;
    const s = l.scale;
    ctx.save();
    ctx.lineWidth = Math.max(1, l.dpr);
    ctx.font = `${Math.round(7 * l.dpr)}px monospace`;
    ctx.textAlign = 'center';
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const h = g.hitbox(e);
      const x = l.play.x + (e.x - h.w / 2) * s;
      const y = l.play.y + (e.y - h.h / 2) * s;
      if (this.hitboxes) {
        ctx.strokeStyle = '#0f0';
        ctx.strokeRect(x, y, h.w * s, h.h * s);
      }
      if (this.labels) {
        ctx.fillStyle = '#ff0';
        ctx.fillText(e.state, l.play.x + e.x * s, y - 2 * l.dpr);
      }
    }
    if (this.hitboxes && g.player.alive) {
      ctx.strokeStyle = '#f0f';
      const p = g.player;
      ctx.strokeRect(l.play.x + (p.x - TUNING.playerHitW / 2) * s, l.play.y + (p.y - TUNING.playerHitH / 2) * s, TUNING.playerHitW * s, TUNING.playerHitH * s);
    }
    ctx.restore();
  }
}
