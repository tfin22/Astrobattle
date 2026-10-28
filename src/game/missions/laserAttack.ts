import { TUNING } from '../../tuning';
import { LASER_ATTACK, byRank } from '../../content/missions';
import { SCORING } from '../../content/scoring';
import { GAME_TEXT } from '../../content/text';
import { FB_W, FB_H } from '../../render/framebuffer';
import { clamp, fatan2, fcos, fsin, PI, TAU } from '../../core/fmath';
import type { Mission } from '../mission';
import type { Game } from '../game';
import type { Enemy } from '../types';

/**
 * Laser Attack: two or three carriers drift across the top, escorted by
 * small fighters that swoop down in loops and return. A carrier stops,
 * charges its laser (a growing glow, a rising tone, then a dotted line where
 * the beam will fall) and fires straight down. Shoot it mid-charge to
 * cancel the shot for a bonus.
 */
export class LaserAttack implements Mission {
  readonly id = 'laserAttack' as const;
  total = 0;
  swoopT = 0;
  /** Escorts orbit this when their carrier is gone. */
  cx = FB_W / 2;
  cy = 70;
  t = 0;
  /** Every laser fired: its charge length (fairness tests). */
  chargeLog: number[] = [];

  init(g: Game): void {
    const d = LASER_ATTACK;
    const n = byRank(d.carriers, g.level);
    const per = byRank(d.escortsPerCarrier, g.level);
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? FB_W / 2 : 40 + (i * (FB_W - 80)) / (n - 1);
      const c = g.spawnEnemy('carrier', x, d.lanes[i % d.lanes.length], 'drift');
      c.hp = byRank(d.carrierHp, g.level);
      c.vx = (i % 2 ? -1 : 1) * TUNING.carrierSpeed * g.rp.speed;
      c.hy = c.y;
      c.cool = d.pattern.firstCharge + i * d.pattern.chargeStagger;
      for (let j = 0; j < per; j++) {
        const e = g.spawnEnemy('escort', x, c.y, 'formation');
        e.link = c.id;
        e.a = (j / per) * TAU;
      }
    }
    this.total = g.enemies.length;
    this.swoopT = 90;
  }

  carriers(g: Game): Enemy[] {
    return g.enemies.filter((e) => e.alive && e.type === 'carrier');
  }

  update(g: Game): void {
    this.t++;
    this.cx = FB_W / 2 + 50 * fsin(this.t * 0.01);
    for (const e of g.enemies) {
      if (!e.alive) continue;
      e.t++;
      if (e.type === 'carrier') this.updateCarrier(g, e);
      else if (e.type === 'escort') this.updateEscort(g, e);
    }
    this.swoop(g);
  }

  private updateCarrier(g: Game, c: Enemy): void {
    const active = this.carriers(g).filter((e) => e.state === 'charging' || e.state === 'firing').length;
    switch (c.state) {
      case 'drift': {
        const pt = LASER_ATTACK.pattern;
        c.x += c.vx;
        if (c.x < pt.edge || c.x > FB_W - pt.edge) {
          c.vx = -c.vx;
          c.x = clamp(c.x, pt.edge, FB_W - pt.edge);
        }
        c.y = c.hy + pt.bob * fsin(c.t * pt.bobRate);
        c.cool--;
        const near = Math.abs(c.x - g.player.x) < pt.chargeWhenWithin;
        const ready = c.cool <= 0 && active < byRank(LASER_ATTACK.maxFiring, g.level);
        if (ready && (near || c.cool < -150 || g.rng.chance(0.004))) {
          g.setState(c, 'charging');
          c.p0 = g.rp.laserCharge;
          this.chargeLog.push(c.p0);
          g.sfx('laserCharge', c.p0);
        }
        break;
      }
      case 'charging':
        // Holds still while charging, so the warning is honest.
        if (c.t >= c.p0) {
          g.setState(c, 'firing');
          g.sfx('laserFire');
        }
        break;
      case 'firing': {
        if (this.beamHits(g, c)) g.killPlayer();
        if (c.t >= TUNING.laserFire) {
          g.setState(c, 'drift');
          c.cool = Math.round((TUNING.laserCooldown / g.rp.fire) * g.rng.range(0.7, 1.3));
        }
        break;
      }
      default:
        break;
    }
  }

  /** The beam: straight down from the emitter. */
  beamRect(c: Enemy): { x0: number; x1: number; y0: number; y1: number } {
    const w = TUNING.laserWidth;
    return { x0: c.x - w / 2, x1: c.x + w / 2, y0: c.y + 5, y1: FB_H };
  }

  beamHits(g: Game, c: Enemy): boolean {
    const p = g.player;
    if (!p.alive) return false;
    const b = this.beamRect(c);
    return p.x + TUNING.playerHitW / 2 > b.x0 && p.x - TUNING.playerHitW / 2 < b.x1 && p.y > b.y0;
  }

  private updateEscort(g: Game, e: Enemy): void {
    const sp = TUNING.escortSpeed * g.rp.speed;
    const pt = LASER_ATTACK.pattern;
    const home = this.homeOf(g, e);
    switch (e.state) {
      case 'formation':
        e.a += pt.orbitRate;
        e.x = home.x;
        e.y = home.y;
        break;
      case 'leaving': {
        // Break out of the orbit sideways and dip.
        e.x += e.p1 * sp * 0.9;
        e.y += sp * 0.5;
        if (e.t > pt.breakFrames) {
          g.setState(e, 'attacking');
          e.r = PI / 2 - e.p1 * 0.4; // heading, radians (pi/2 = straight down)
          e.p0 = 0; // loop progress
        }
        break;
      }
      case 'attacking': {
        const p = g.player;
        if (e.p0 === 0) {
          // Dive, steering gently toward the player.
          const want = clamp(fatan2(p.y - e.y, p.x - e.x), 0.4, PI - 0.4);
          e.r += clamp(want - e.r, -pt.steer, pt.steer);
          if (e.y > pt.loopAtY + e.p2) {
            e.p0 = 0.0001; // start the loop
            e.p1 = e.x < p.x ? -1 : 1; // loop away from the player's side
            g.aimDart(e.x, e.y + 3);
          }
        } else {
          // The loop: turn a full circle, then climb home.
          const turn = pt.loopTurn * e.p1;
          e.r += turn;
          e.p0 += Math.abs(turn);
          if (e.p0 >= TAU) {
            g.setState(e, 'returning');
          }
        }
        e.x += fcos(e.r) * sp;
        e.y += fsin(e.r) * sp;
        e.x = clamp(e.x, 4, FB_W - 4);
        if (g.rng.chance(pt.dartChance * g.rp.fire)) g.aimDart(e.x, e.y + 3);
        break;
      }
      case 'returning': {
        e.a += pt.orbitRate;
        const dx = home.x - e.x;
        const dy = home.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d < sp * 1.5) {
          g.setState(e, 'formation');
        } else {
          e.x += (dx / d) * sp * pt.returnBoost;
          e.y += (dy / d) * sp * pt.returnBoost;
        }
        break;
      }
      default:
        break;
    }
  }

  private homeOf(g: Game, e: Enemy): { x: number; y: number } {
    let c = g.enemies.find((o) => o.id === e.link && o.alive);
    if (!c) {
      // Carrier gone: join another, or circle the middle.
      c = this.carriers(g)[0];
      if (c) e.link = c.id;
    }
    const cx = c ? c.x : this.cx;
    const cy = c ? c.y : this.cy;
    const pt = LASER_ATTACK.pattern;
    return { x: cx + fcos(e.a) * pt.orbitRX, y: cy + fsin(e.a) * pt.orbitRY + 2 };
  }

  private swoop(g: Game): void {
    if (--this.swoopT > 0) return;
    this.swoopT = Math.round((TUNING.escortSwoopEvery / g.rp.dive) * g.rng.range(0.6, 1.4));
    const out = g.enemies.filter((e) => e.alive && e.type === 'escort' && e.state !== 'formation').length;
    if (out >= byRank(LASER_ATTACK.maxSwooping, g.level)) return;
    const form = g.enemies.filter((e) => e.alive && e.type === 'escort' && e.state === 'formation');
    if (!form.length) return;
    const e = g.rng.pick(form);
    g.setState(e, 'leaving');
    e.p1 = e.x < FB_W / 2 ? -1 : 1;
    e.p2 = g.rng.range(-LASER_ATTACK.pattern.loopJitter, LASER_ATTACK.pattern.loopJitter); // vary where the loop happens
  }

  onHit(g: Game, e: Enemy): boolean {
    if (e.type !== 'carrier') return false;
    if (e.state === 'charging') {
      // Cancelled mid-charge: the laser never fires.
      g.setState(e, 'drift');
      e.cool = Math.round(TUNING.laserCooldown / g.rp.fire);
      g.events.push({ t: 'sfxStop', id: 'laserCharge' });
      g.addScore(SCORING.carrierCancelBonus);
      g.popupText(`${GAME_TEXT.cancel} ${SCORING.carrierCancelBonus}`, e.x, e.y - 10);
    }
    g.damageEnemy(e);
    return true;
  }

  onPlayerDeath(g: Game): void {
    for (const c of this.carriers(g)) {
      if (c.state === 'charging' || c.state === 'firing') {
        g.setState(c, 'drift');
        c.cool = TUNING.laserCooldown;
      }
    }
    g.events.push({ t: 'sfxStop', id: 'laserCharge' });
  }

  isClear(g: Game): boolean {
    return !g.enemies.some((e) => e.alive && (e.type === 'carrier' || e.type === 'escort'));
  }

  remaining(g: Game): number {
    return g.enemies.filter((e) => e.alive && e.type !== 'saucer').length / Math.max(1, this.total);
  }
}
