import { TUNING } from '../../tuning';
import { SPACE_WARP, byRank } from '../../content/missions';
import { FB_W, FB_H } from '../../render/framebuffer';
import { fcos, fsin, TAU } from '../../core/fmath';
import type { Mission } from '../mission';
import type { Game } from '../game';
import type { Enemy } from '../types';

/**
 * Space Warp: a colour-cycling vortex in the middle of the screen. Enemies
 * emerge from it small and spiral outward, growing as they come and firing
 * once they're out. Hit them early (small, hard, low risk) or late (big,
 * easy, high risk). Any that escape off screen go back into the vortex.
 */
export class SpaceWarp implements Mission {
  readonly id = 'spaceWarp' as const;
  readonly thins = true;
  readonly cx = FB_W / 2;
  readonly cy: number = TUNING.warpCentreY;
  total = 0;
  toSpawn = 0;
  spawnT = 50;
  private spins = 0;

  init(g: Game): void {
    this.total = byRank(SPACE_WARP.total, g.level);
    this.toSpawn = this.total;
  }

  warplings(g: Game): Enemy[] {
    return g.enemies.filter((e) => e.alive && e.type === 'warpling');
  }

  update(g: Game): void {
    const active = this.warplings(g).length;
    if (--this.spawnT <= 0 && this.toSpawn > 0 && active < byRank(SPACE_WARP.maxActive, g.level)) {
      this.spawn(g);
      this.spawnT = Math.round((g.rp.warpSpawn / g.urgeSpeed) * g.rng.range(0.8, 1.25));
    }
    for (const e of g.enemies) {
      if (!e.alive || e.type !== 'warpling') continue;
      e.t++;
      this.move(g, e);
    }
  }

  private spawn(g: Game): void {
    const e = g.spawnEnemy('warpling', this.cx, this.cy, 'emerging');
    e.a = g.rng.range(0, TAU);
    e.r = 0;
    const both = g.rp.rank >= SPACE_WARP.bothWaysFromRank;
    e.p0 = both && this.spins++ % 2 ? -1 : 1; // spin direction
    e.cool = 40;
    this.toSpawn--;
    g.sfx('warpOut');
  }

  private move(g: Game, e: Enemy): void {
    const sp = g.pace;
    const pt = SPACE_WARP.pattern;
    // Spins fast near the centre, slows as it grows; grows faster as it goes.
    e.a += TUNING.warpSpin * sp * e.p0 * (1 + pt.spinBoost / (e.r + 8));
    e.r += TUNING.warpGrowth * sp * (pt.growthBase + e.r / pt.growthRamp);
    e.x = this.cx + fcos(e.a) * e.r;
    e.y = this.cy + fsin(e.a) * e.r * pt.squash;
    e.stage = e.r < pt.mediumAt ? 0 : e.r < pt.largeAt ? 1 : 2;
    if (e.r > TUNING.warpFireRadius && --e.cool <= 0) {
      e.cool = Math.round((pt.fireEvery / (g.rp.fire * g.urgeFire)) * g.rng.range(0.7, 1.3));
      if (e.y < g.player.y - 30) g.aimDart(e.x, e.y + 4);
    }
    if (e.x < -14 || e.x > FB_W + 14 || e.y < TUNING.hudTop - 10 || e.y > FB_H + 14) {
      // Escaped: back into the vortex to come round again.
      e.alive = false;
      this.toSpawn++;
    }
  }

  isClear(g: Game): boolean {
    return this.toSpawn === 0 && this.warplings(g).length === 0;
  }

  remaining(g: Game): number {
    return (this.toSpawn + this.warplings(g).length) / Math.max(1, this.total);
  }
}
