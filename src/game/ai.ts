import { TUNING } from '../tuning';
import { FB_W } from '../render/framebuffer';
import type { Game } from './game';
import type { Enemy, FrameInput } from './types';

export type BotStyle = 'patient' | 'spammer';

/**
 * A simple pilot that reads the game state and returns input. Used by the
 * attract-mode demo and by tests. Both styles move and dodge the same way;
 * they differ only in how they use the fire button:
 *  - patient: lines up a shot that will land, and only snaps a new one if
 *    the shot in flight is going to miss;
 *  - spammer: taps FIRE every few frames whatever happens.
 */
export class Bot {
  private last = new Map<number, { x: number; y: number }>();
  private vel = new Map<number, { vx: number; vy: number }>();
  private tick = 0;

  constructor(readonly style: BotStyle = 'patient', readonly tapEvery = 6) {}

  think(g: Game): FrameInput {
    this.tick++;
    this.trackVelocities(g);
    const p = g.player;
    const out: FrameInput = { mx: 0, my: 0, fire: false, fireHeld: false };
    if (g.phase !== 'play' || !p.alive) {
      // Skip title cards quickly in tests; harmless elsewhere.
      out.fire = g.phase === 'card' && this.tick % 30 === 0;
      return out;
    }

    const target = this.pickTarget(g);
    let goalX = target ? target.x : FB_W / 2;
    const danger = this.dangerX(g);
    if (danger !== null) {
      // Step away from the threat, toward the roomier side.
      goalX = danger < p.x ? Math.min(FB_W - 16, p.x + 24) : Math.max(16, p.x - 24);
      if (Math.abs(danger - p.x) > 16) goalX = target ? target.x : p.x;
    }
    const dx = goalX - p.x;
    if (Math.abs(dx) > 1) out.mx = dx > 0 ? 1 : -1;
    // Stay low: more time to react.
    if (p.y < TUNING.zoneBottom - 1) out.my = 1;

    if (this.style === 'spammer') {
      out.fire = this.tick % this.tapEvery === 0;
      return out;
    }
    if (!target) return out;
    const aligned = Math.abs(target.x - p.x) <= Math.max(1, g.hitbox(target.e).w / 2 - 1);
    if (!g.shot.alive) {
      out.fire = aligned;
    } else if (aligned && this.shotWillMiss(g) && g.shot.y > 120) {
      out.fire = true; // the quantum cancel: snap a better shot
    }
    return out;
  }

  private trackVelocities(g: Game): void {
    const seen = new Set<number>();
    for (const e of g.enemies) {
      if (!e.alive) continue;
      seen.add(e.id);
      const prev = this.last.get(e.id);
      if (prev) {
        const v = this.vel.get(e.id) ?? { vx: 0, vy: 0 };
        // Smooth: marching blocks move in steps.
        v.vx = v.vx * 0.8 + (e.x - prev.x) * 0.2;
        v.vy = v.vy * 0.8 + (e.y - prev.y) * 0.2;
        this.vel.set(e.id, v);
      }
      this.last.set(e.id, { x: e.x, y: e.y });
    }
    for (const id of [...this.last.keys()]) if (!seen.has(id)) {
      this.last.delete(id);
      this.vel.delete(id);
    }
  }

  /** Where an enemy will be when a shot fired now reaches its height. */
  private predictX(g: Game, e: Enemy): number {
    const v = this.vel.get(e.id) ?? { vx: 0, vy: 0 };
    const t = Math.max(0, (g.player.y - 7 - e.y) / (TUNING.shotSpeed - v.vy));
    return e.x + v.vx * t;
  }

  private pickTarget(g: Game): { x: number; e: Enemy } | null {
    let best: { x: number; e: Enemy } | null = null;
    let bestScore = Infinity;
    const p = g.player;
    const targets = this.reactorTarget(g);
    if (targets) return targets;
    for (const e of g.enemies) {
      if (!e.alive || e.y > p.y - 10) continue;
      const x = this.predictX(g, e);
      if (x < 10 || x > FB_W - 10) continue;
      const score = Math.abs(x - p.x) + (p.y - e.y) * 0.25;
      if (score < bestScore) {
        bestScore = score;
        best = { x, e };
      }
    }
    return best;
  }

  /** In the Flagship mission, dig at the reactor's column. */
  private reactorTarget(g: Game): { x: number; e: Enemy } | null {
    if (g.mission.id !== 'flagship') return null;
    const m = g.mission as unknown as { x: number; dir: number; speedPx: number };
    if (typeof m.x !== 'number') return null;
    const t = (g.player.y - 70) / TUNING.shotSpeed;
    const x = m.x + m.dir * (m.speedPx ?? 0.5) * t;
    const fake = { id: -1, type: 'fighter', x, y: 70, stage: 0 } as unknown as Enemy;
    // Fighters near the bottom take priority over digging.
    for (const e of g.enemies) if (e.alive && e.y > 150) return null;
    return { x, e: fake };
  }

  private shotWillMiss(g: Game): boolean {
    const s = g.shot;
    for (const e of g.enemies) {
      if (!e.alive || e.y > s.y) continue;
      const v = this.vel.get(e.id) ?? { vx: 0, vy: 0 };
      const t = (s.y - e.y) / TUNING.shotSpeed;
      const ex = e.x + v.vx * t;
      if (Math.abs(ex - s.x) <= g.hitbox(e).w / 2) return false;
    }
    return true;
  }

  /** x of the nearest threat about to reach the ship, or null. */
  private dangerX(g: Game): number | null {
    const p = g.player;
    let best: number | null = null;
    let bestT = Infinity;
    for (const b of g.bullets) {
      if (b.vy <= 0) continue;
      const t = (p.y - b.y) / b.vy;
      if (t < 0 || t > 45) continue;
      const x = b.x + b.vx * t;
      if (Math.abs(x - p.x) < 10 && t < bestT) {
        bestT = t;
        best = x;
      }
    }
    for (const e of g.enemies) {
      if (!e.alive) continue;
      if ((e.state === 'charging' || e.state === 'firing') && Math.abs(e.x - p.x) < 14) return e.x;
      if (e.state === 'attacking' || e.state === 'emerging' || e.state === 'leaving') {
        const v = this.vel.get(e.id) ?? { vx: 0, vy: 0 };
        if (v.vy > 0.2) {
          const t = (p.y - e.y) / v.vy;
          if (t > 0 && t < 50) {
            const x = e.x + v.vx * t;
            if (Math.abs(x - p.x) < 14 && t < bestT) {
              bestT = t;
              best = x;
            }
          }
        } else if (Math.abs(e.y - p.y) < 30 && Math.abs(e.x - p.x) < 16) {
          return e.x;
        }
      }
    }
    return best;
  }
}
