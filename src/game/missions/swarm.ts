import { TUNING } from '../../tuning';
import { SWARM, byRank } from '../../content/missions';
import { FB_W, FB_H } from '../../render/framebuffer';
import { clamp, fsin, fcos, TAU } from '../../core/fmath';
import type { Mission } from '../mission';
import type { Game } from '../game';
import type { Enemy } from '../types';

/**
 * Swarm (our own mission, replacing the arcade's nod to another game): a
 * loose cloud that drifts and breathes rather than a grid. Small groups
 * break away and dive in curving runs that weave across each other,
 * sometimes splitting into pairs half way down. Kamikazes aim for where
 * you will be, then commit: a late sidestep sends them past.
 */
export class Swarm implements Mission {
  readonly id = 'swarm' as const;
  readonly thins = true;
  total = 0;
  t = 0;
  cx = FB_W / 2;
  cy = 92;
  diveT = 0;
  nextGroup = 1;

  init(g: Game): void {
    const n = byRank(SWARM.count, g.level);
    const kShare = byRank(SWARM.kamikazeShare, g.level);
    const R = SWARM.cloudRadius;
    this.cy = SWARM.cloudY;
    // Scatter home offsets through an ellipse with jitter: a cloud, not rows.
    for (let i = 0; i < n; i++) {
      const ring = Math.sqrt((i + 0.5) / n);
      const a = i * 2.399963 + g.rng.range(-0.3, 0.3); // golden-angle spiral
      const hx = fcos(a) * ring * R * SWARM.pattern.spreadX + g.rng.range(-3, 3);
      const hy = fsin(a) * ring * R * SWARM.pattern.spreadY + g.rng.range(-2, 2);
      const type = g.rng.chance(kShare) ? 'kamikaze' : 'swarmer';
      const e = g.spawnEnemy(type, this.cx + hx, this.cy + hy, 'formation');
      e.hx = hx;
      e.hy = hy;
      e.p2 = g.rng.range(0, TAU); // breathing phase
    }
    this.total = n;
    this.diveT = 100;
  }

  private home(e: Enemy): { x: number; y: number } {
    const b = 1 + SWARM.pattern.breathe * fsin(this.t * TUNING.swarmBreathe + e.p2);
    return { x: this.cx + e.hx * b, y: this.cy + e.hy * b };
  }

  update(g: Game): void {
    this.t++;
    const drift = TUNING.swarmDriftSpeed * g.rp.speed;
    this.cx = FB_W / 2 + SWARM.pattern.wanderX * fsin(this.t * drift);
    this.cy = SWARM.cloudY + SWARM.pattern.wanderY * fsin(this.t * drift * 1.7 + 1);
    for (const e of g.enemies) {
      if (!e.alive || (e.type !== 'swarmer' && e.type !== 'kamikaze')) continue;
      e.t++;
      this.updateMember(g, e);
    }
    this.launch(g);
  }

  private launch(g: Game): void {
    if (--this.diveT > 0) return;
    this.diveT = Math.round((TUNING.swarmDiveEvery / (g.rp.dive * g.rp.swarm * g.urgeSpeed)) * g.rng.range(0.6, 1.3));
    const members = g.enemies.filter((e) => e.alive && (e.type === 'swarmer' || e.type === 'kamikaze'));
    const diving = members.filter((e) => e.state !== 'formation').length;
    if (diving >= byRank(SWARM.maxDiving, g.level)) return;
    const form = members.filter((e) => e.state === 'formation');
    if (!form.length) return;
    // A small group of neighbours breaks away together.
    const seed = g.rng.pick(form);
    const size = Math.min(byRank(SWARM.groupSize, g.level), form.length);
    const group = [...form].sort((a, b) => Math.hypot(a.hx - seed.hx, a.hy - seed.hy) - Math.hypot(b.hx - seed.hx, b.hy - seed.hy)).slice(0, size);
    const side = seed.hx < 0 ? -1 : 1;
    const gid = this.nextGroup++;
    const split = g.rng.chance(SWARM.pattern.splitChance);
    group.forEach((e, i) => {
      g.setState(e, 'leaving');
      e.link = gid;
      e.p0 = side;
      e.p1 = i; // lane within the group
      e.a = split ? 1 : 0; // split into pairs mid-dive
      e.r = g.rng.range(0, 1); // weave phase jitter
    });
  }

  private updateMember(g: Game, e: Enemy): void {
    const sp = TUNING.swarmDiveSpeed * g.pace;
    switch (e.state) {
      case 'formation': {
        const h = this.home(e);
        e.x = h.x;
        e.y = h.y;
        break;
      }
      case 'leaving': {
        // Peel out to the side in a rising curve.
        e.x += e.p0 * sp * 0.8;
        e.y += -0.6 + e.t * 0.06;
        if (e.t > SWARM.pattern.leaveFrames) {
          g.setState(e, 'attacking');
          e.vx = e.x; // remember the dive's centre line
          e.vy = e.y;
          if (e.type === 'kamikaze') this.aimKamikaze(g, e);
        }
        break;
      }
      case 'attacking':
        if (e.type === 'kamikaze') this.kamikaze(g, e);
        else this.weave(g, e, sp);
        if (e.y > FB_H + 10) {
          g.setState(e, 'returning');
          e.y = -10;
          e.x = clamp(e.x, 10, FB_W - 10);
        }
        break;
      case 'returning': {
        const h = this.home(e);
        const dx = h.x - e.x;
        const dy = h.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d < sp * 1.5) g.setState(e, 'formation');
        else {
          e.x += (dx / d) * sp;
          e.y += (dy / d) * sp;
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * Curving runs: each diver weaves around the group's centre line with an
   * opposite phase to its neighbour, so their paths cross. Groups that
   * split peel into two pairs once past the middle.
   */
  private weave(g: Game, e: Enemy, sp: number): void {
    const t = e.t;
    const pt = SWARM.pattern;
    const lanePhase = (e.p1 % 2) * Math.PI + e.r * 0.4;
    const amp = pt.weaveAmp + (e.p1 >> 1) * pt.weaveLaneAmp;
    // The centre line drifts toward the player as it falls.
    const centre = e.vx + (g.player.x - e.vx) * Math.min(1, t / pt.homingFrames);
    let x = centre + amp * fsin(t * pt.weaveRate + lanePhase);
    if (e.a === 1 && e.y > pt.splitAtY) {
      const pair = e.p1 < 2 ? -1 : 1;
      x += pair * Math.min(pt.splitMax, (e.y - pt.splitAtY) * 0.5);
    }
    e.x = clamp(x, 4, FB_W - 4);
    e.y += sp * 0.85;
    if (t % pt.dartEvery === 20 && e.y < 200 && g.rng.chance(0.5 * g.rp.fire * g.urgeFire)) g.aimDart(e.x, e.y + 4);
  }

  /** Aim at where the player will be when we get there. */
  private aimKamikaze(g: Game, e: Enemy): void {
    const p = g.player;
    const sp = TUNING.kamikazeSpeed * g.pace;
    const frames = Math.max(10, (p.y - e.y) / sp);
    const tx = clamp(p.x + p.vx * frames * TUNING.kamikazeLead, 8, FB_W - 8);
    const dx = tx - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.vx = (dx / d) * sp; // committed velocity
    e.vy = (dy / d) * sp;
  }

  private kamikaze(g: Game, e: Enemy): void {
    // Re-aim briefly at the start of the dive, then commit.
    if (e.t < 30 && e.t % 10 === 0) this.aimKamikaze(g, e);
    e.x += e.vx;
    e.y += e.vy;
  }

  isClear(g: Game): boolean {
    return !g.enemies.some((e) => e.alive && (e.type === 'swarmer' || e.type === 'kamikaze'));
  }

  remaining(g: Game): number {
    return g.enemies.filter((e) => e.alive && (e.type === 'swarmer' || e.type === 'kamikaze')).length / Math.max(1, this.total);
  }
}
