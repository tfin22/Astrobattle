import { TUNING } from '../../tuning';
import { FLAGSHIP_MISSION, byRank } from '../../content/missions';
import { SCORING } from '../../content/scoring';
import { FLAGSHIP } from '../../content/sprites';
import { FB_W, FB_H } from '../../render/framebuffer';
import { clamp, fsin } from '../../core/fmath';
import type { Mission } from '../mission';
import type { Game } from '../game';
import type { Enemy } from '../types';

const BODY_W = FLAGSHIP.frames[0][0].length;
const BODY_H = FLAGSHIP.frames[0].length;

/**
 * Flagship: VORG's flagship slides back and forth across the top, bombing
 * and launching fighters. Its underside is a band of hull blocks; shots chip
 * a channel, and the reactor sits in a notch behind them. The ship drifts,
 * so the channel moves with it: commit, or start again. Hull damage stays
 * when you lose a ship.
 */
export class Flagship implements Mission {
  readonly id = 'flagship' as const;
  x = FB_W / 2;
  readonly y: number = TUNING.flagshipY;
  dir = 1;
  speedPx: number = TUNING.flagshipSpeed;
  readonly cols: number = TUNING.hullCols;
  rows = 4;
  hull = new Uint8Array(0);
  hullTotal = 0;
  fighterT = 180;
  bombT = 90;
  t = 0;
  reactorHit = false;

  init(g: Game): void {
    this.rows = g.rp.hullRows;
    this.hull = new Uint8Array(this.cols * this.rows).fill(1);
    this.hullTotal = this.hull.length;
    this.speedPx = TUNING.flagshipSpeed * g.rp.speed;
  }

  get bodyTop(): number {
    return Math.round(this.y - BODY_H / 2);
  }
  get bodyLeft(): number {
    return Math.round(this.x - BODY_W / 2);
  }
  get hullTop(): number {
    return this.bodyTop + BODY_H;
  }
  get hullLeft(): number {
    return Math.round(this.x - (this.cols * TUNING.hullBlockW) / 2);
  }
  /** The reactor: in the notch at the bottom centre of the body. */
  reactorRect(): { x0: number; x1: number; y0: number; y1: number } {
    const hw = FLAGSHIP_MISSION.reactorHalfW;
    return { x0: Math.round(this.x) - hw, x1: Math.round(this.x) + hw, y0: this.bodyTop + BODY_H - 2, y1: this.bodyTop + BODY_H };
  }

  blockAt(c: number, r: number): boolean {
    return this.hull[r * this.cols + c] === 1;
  }

  update(g: Game): void {
    this.t++;
    if (this.t === 1) g.sfx('flagAlarm');
    this.x += this.dir * this.speedPx;
    const lim = BODY_W / 2 + 4;
    if (this.x < lim || this.x > FB_W - lim) {
      this.dir = -this.dir;
      this.x = clamp(this.x, lim, FB_W - lim);
    }
    if (--this.bombT <= 0) {
      this.bombT = Math.round((TUNING.flagshipBombEvery / g.rp.fire) * g.rng.range(0.6, 1.4));
      g.dropBomb(this.x + g.rng.range(-FLAGSHIP_MISSION.pattern.bombSpread, FLAGSHIP_MISSION.pattern.bombSpread), this.hullTop + this.rows * TUNING.hullBlockH + 2);
    }
    const fighters = g.enemies.filter((e) => e.alive && e.type === 'fighter');
    if (--this.fighterT <= 0) {
      this.fighterT = Math.round((TUNING.flagshipFighterEvery / g.rp.dive) * g.rng.range(0.7, 1.3));
      if (fighters.length < byRank(FLAGSHIP_MISSION.maxFighters, g.level)) {
        const side = g.rng.sign();
        const f = g.spawnEnemy('fighter', this.x + side * FLAGSHIP_MISSION.pattern.launchOffset, this.y + 4, 'leaving');
        f.p0 = side;
      }
    }
    for (const f of fighters) {
      f.t++;
      this.updateFighter(g, f);
    }
  }

  private updateFighter(g: Game, f: Enemy): void {
    const sp = TUNING.escortSpeed * g.rp.speed;
    const pt = FLAGSHIP_MISSION.pattern;
    switch (f.state) {
      case 'leaving':
        f.x += f.p0 * sp;
        f.y += sp * 0.4;
        if (f.t > pt.leaveFrames) {
          g.setState(f, 'attacking');
          f.vx = f.x;
        }
        break;
      case 'attacking': {
        // Weave down toward the player.
        f.vx += Math.sign(g.player.x - f.vx) * pt.homing;
        f.x = clamp(f.vx + pt.weaveAmp * fsin(f.t * pt.weaveRate * f.p0), 4, FB_W - 4);
        f.y += sp * 0.8;
        if (f.t % pt.dartEvery === 30 && f.y < 200) g.aimDart(f.x, f.y + 3);
        if (f.y > FB_H + 8) f.alive = false; // gone back to the ship
        break;
      }
      default:
        break;
    }
  }

  shotScenery(g: Game, x: number, y: number): boolean {
    const bw = TUNING.hullBlockW;
    const bh = TUNING.hullBlockH;
    const hl = this.hullLeft;
    const ht = this.hullTop;
    // Hull blocks: chip one off.
    if (x >= hl && x < hl + this.cols * bw && y >= ht && y < ht + this.rows * bh) {
      const c = Math.floor((x - hl) / bw);
      const r = Math.floor((y - ht) / bh);
      if (this.blockAt(c, r)) {
        this.hull[r * this.cols + c] = 0;
        g.addScore(SCORING.hullBlock);
        g.sfx('chip');
        g.addParticle({ kind: 'spark', x, y: ht + r * bh + 1, vx: 0, vy: 0.5, life: 10, max: 10, r: 0, vr: 0, pen: 0 });
        return true;
      }
      return false; // through the channel
    }
    // The reactor.
    const rr = this.reactorRect();
    if (!this.reactorHit && x >= rr.x0 && x <= rr.x1 && y >= rr.y0 - 1 && y <= rr.y1) {
      this.reactorHit = true;
      g.reactorDestroyed(this.x, this.y + 4);
      return true;
    }
    // The body absorbs anything else.
    const bx = Math.round(x) - this.bodyLeft;
    const by = Math.round(y) - this.bodyTop;
    if (bx >= 0 && bx < BODY_W && by >= 0 && by < BODY_H) {
      if (FLAGSHIP.frames[0][by][bx] !== '.') {
        g.sfx('clink');
        return true;
      }
    }
    return false;
  }

  /** How much of the hull guarding the reactor is left (pulse speed). */
  remaining(): number {
    let left = 0;
    for (let i = 0; i < this.hull.length; i++) left += this.hull[i];
    return left / Math.max(1, this.hullTotal);
  }

  isClear(): boolean {
    return false; // only the reactor ends this mission
  }
}
