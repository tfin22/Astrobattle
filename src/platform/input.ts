import { TUNING } from '../tuning';
import { inRect, toGame, type Layout } from '../render/layout';

/** What the game reads once per simulation step. */
export interface FrameInput {
  mx: number; // -1, 0, 1
  my: number;
  fire: boolean;     // pressed since the last step
  fireHeld: boolean;
}

/** Everything the app shell reads per step (game input plus UI keys). */
export interface AppInput extends FrameInput {
  start: boolean;
  coin: boolean;
  pause: boolean;
  debug: boolean;
  back: boolean;
  /** Taps on the picture, in framebuffer coordinates. */
  taps: { x: number; y: number }[];
  /** Menu edges: a new push of the stick/keys in a direction. */
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface StickView {
  active: boolean;
  ox: number;
  oy: number;
  kx: number;
  ky: number;
}

type Dir = { x: number; y: number };

function eightWay(dx: number, dy: number, dead: number): Dir {
  const len = Math.hypot(dx, dy);
  if (len < dead) return { x: 0, y: 0 };
  const a = Math.atan2(dy, dx);
  const oct = Math.round(a / (Math.PI / 4));
  const dirs: Dir[] = [
    { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
    { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  ];
  return dirs[((oct % 8) + 8) % 8];
}

export { eightWay };

export class InputManager {
  layout!: Layout;
  dpadMode = false;
  /** Called on every pointer-up (used for fullscreen requests). */
  onGesture: (() => void) | null = null;
  stick: StickView = { active: false, ox: 0, oy: 0, kx: 0, ky: 0 };
  firePressedVisual = false;
  touchSeen = false;

  private keys = new Set<string>();
  private keyPresses = new Set<string>();
  private stickId: number | null = null;
  private stickDir: Dir = { x: 0, y: 0 };
  private fireIds = new Set<number>();
  private firePresses = 0;
  private taps: { x: number; y: number }[] = [];
  private prevDir: Dir = { x: 0, y: 0 };
  private padPrevButtons: boolean[] = [];
  private padFirePresses = 0;
  private padHeld = false;
  private padDir: Dir = { x: 0, y: 0 };
  private activePointers = new Set<number>();
  private debugRequested = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => this.releaseAll());
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    let k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    // Plain D is WASD's "right"; Shift+D (or the backquote key) opens debug.
    if ((k === 'd' && e.shiftKey) || k === '`') k = 'debug';
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
    if (down) {
      if (!this.keys.has(k)) this.keyPresses.add(k);
      this.keys.add(k);
    } else {
      this.keys.delete(k);
    }
  }

  private dev(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const d = this.layout.dpr;
    return { x: (e.clientX - r.left) * d, y: (e.clientY - r.top) * d };
  }

  private onDown(e: PointerEvent): void {
    e.preventDefault();
    if (e.pointerType === 'touch') this.touchSeen = true;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* not all browsers allow capture here */
    }
    // Three fingers down at once toggles the debug overlay.
    this.activePointers.add(e.pointerId);
    if (this.activePointers.size === 3) this.debugRequested = true;
    const p = this.dev(e);
    const l = this.layout;
    if (l.controls.h > 0 && inRect(l.stickZone, p.x, p.y) && this.stickId === null) {
      this.stickId = e.pointerId;
      if (this.dpadMode) {
        this.stick = { active: true, ox: l.dpad.x, oy: l.dpad.y, kx: p.x, ky: p.y };
      } else {
        this.stick = { active: true, ox: p.x, oy: p.y, kx: p.x, ky: p.y };
      }
      this.updateStick(p);
      return;
    }
    if (l.controls.h > 0 && inRect(l.fireZone, p.x, p.y)) {
      this.fireIds.add(e.pointerId);
      this.firePresses++;
      this.firePressedVisual = true;
      return;
    }
    if (inRect(l.play, p.x, p.y) || l.controls.h === 0) {
      this.taps.push(toGame(l, p.x, p.y));
    }
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.stickId) return;
    e.preventDefault();
    this.updateStick(this.dev(e));
  }

  private updateStick(p: { x: number; y: number }): void {
    const d = this.layout.dpr;
    if (this.dpadMode) {
      this.stick.kx = p.x;
      this.stick.ky = p.y;
      this.stickDir = eightWay(p.x - this.stick.ox, p.y - this.stick.oy, TUNING.dpadDeadZoneCss * d);
      return;
    }
    const maxR = TUNING.stickRadiusCss * d;
    let dx = p.x - this.stick.ox;
    let dy = p.y - this.stick.oy;
    const len = Math.hypot(dx, dy);
    if (len > maxR) {
      // Firm edge: the base is dragged along so reversing is instant.
      this.stick.ox = p.x - (dx / len) * maxR;
      this.stick.oy = p.y - (dy / len) * maxR;
      dx = p.x - this.stick.ox;
      dy = p.y - this.stick.oy;
    }
    this.stick.kx = p.x;
    this.stick.ky = p.y;
    this.stickDir = eightWay(dx, dy, TUNING.stickDeadZoneCss * d);
  }

  private onUp(e: PointerEvent): void {
    this.activePointers.delete(e.pointerId);
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.stick.active = false;
      this.stickDir = { x: 0, y: 0 };
    }
    if (this.fireIds.delete(e.pointerId) && this.fireIds.size === 0) this.firePressedVisual = false;
    this.onGesture?.();
  }

  private releaseAll(): void {
    this.activePointers.clear();
    this.keys.clear();
    this.stickId = null;
    this.stick.active = false;
    this.stickDir = { x: 0, y: 0 };
    this.fireIds.clear();
    this.firePressedVisual = false;
  }

  private pollPad(): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    let dir: Dir = { x: 0, y: 0 };
    let held = false;
    const buttons: boolean[] = [];
    for (const pad of pads) {
      if (!pad) continue;
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const sd = eightWay(ax, ay, 0.35);
      dir = {
        x: sd.x || (b(15) ? 1 : b(14) ? -1 : 0),
        y: sd.y || (b(13) ? 1 : b(12) ? -1 : 0),
      };
      for (let i = 0; i < 17; i++) buttons[i] = b(i);
      held = b(0) || b(1) || b(2) || b(3);
      break;
    }
    for (const i of [0, 1, 2, 3]) {
      if (buttons[i] && !this.padPrevButtons[i]) this.padFirePresses++;
    }
    this.padStart = !!buttons[9] && !this.padPrevButtons[9];
    this.padCoin = !!buttons[8] && !this.padPrevButtons[8];
    this.padPrevButtons = buttons;
    this.padHeld = held;
    this.padDir = dir;
  }
  private padStart = false;
  private padCoin = false;

  /** Collect input for one simulation step. */
  sample(): AppInput {
    this.pollPad();
    const k = this.keys;
    const kp = this.keyPresses;
    let mx = 0;
    let my = 0;
    if (k.has('ArrowLeft') || k.has('a')) mx -= 1;
    if (k.has('ArrowRight') || k.has('d')) mx += 1;
    if (k.has('ArrowUp') || k.has('w')) my -= 1;
    if (k.has('ArrowDown') || k.has('s')) my += 1;
    mx = mx || this.stickDir.x || this.padDir.x;
    my = my || this.stickDir.y || this.padDir.y;
    mx = Math.sign(mx);
    my = Math.sign(my);
    const keyFire = kp.has(' ') || kp.has('z');
    const fire = keyFire || this.firePresses > 0 || this.padFirePresses > 0;
    const fireHeld = k.has(' ') || k.has('z') || this.fireIds.size > 0 || this.padHeld;
    const dir = { x: mx, y: my };
    const out: AppInput = {
      mx,
      my,
      fire,
      fireHeld,
      start: kp.has('1') || kp.has('Enter') || this.padStart,
      coin: kp.has('5') || this.padCoin,
      pause: kp.has('p') || kp.has('Escape'),
      debug: kp.has('debug') || this.debugRequested,
      back: kp.has('Escape') || kp.has('Backspace'),
      taps: this.taps,
      up: dir.y < 0 && this.prevDir.y >= 0,
      down: dir.y > 0 && this.prevDir.y <= 0,
      left: dir.x < 0 && this.prevDir.x >= 0,
      right: dir.x > 0 && this.prevDir.x <= 0,
    };
    this.prevDir = dir;
    this.taps = [];
    this.firePresses = 0;
    this.padFirePresses = 0;
    this.debugRequested = false;
    kp.clear();
    return out;
  }
}
