import { TUNING } from '../../tuning';
import { SHIELD_WALL, byRank } from '../../content/missions';
import { FB_W, FB_H } from '../../render/framebuffer';
import { clamp, lerp } from '../../core/fmath';
import type { Mission } from '../mission';
import type { Game } from '../game';
import type { Bullet, Enemy } from '../types';

/**
 * Shield Wall: a marching block of fighters over an arched force field.
 * Bombs and your own shots eat the field pixel by pixel; some fighters
 * peel off and dive at it.
 */
export class ShieldWall implements Mission {
  readonly id = 'shieldWall' as const;
  readonly ownPulse = true;
  /** 1 = force field present. Full-screen mask for simple indexing. */
  readonly field = new Uint8Array(FB_W * FB_H);
  fieldTop = 0;
  fieldBottom = 0;
  total = 0;
  dir = 1;
  originX = 0;
  originY = 0;
  marchT = 0;
  anim = 0;
  diveT = 0;
  blockWidth = 0;

  init(g: Game): void {
    const d = SHIELD_WALL;
    const rows: string[] = [...d.formation];
    if (g.rp.rank >= d.extraRowFromRank) rows.push(d.extraRow);
    const cols = rows[0].length;
    this.blockWidth = (cols - 1) * d.spacingX;
    this.originX = Math.round((FB_W - this.blockWidth) / 2);
    this.originY = d.top;
    rows.forEach((row, r) => {
      for (let c = 0; c < cols; c++) {
        if (row[c] !== 'X') continue;
        const e = g.spawnEnemy('drone', this.originX + c * d.spacingX, this.originY + r * d.spacingY, 'formation');
        e.hx = c * d.spacingX;
        e.hy = r * d.spacingY;
      }
    });
    this.total = g.enemies.length;
    this.buildField();
    this.marchT = TUNING.wallTickSlow;
    this.diveT = Math.round(TUNING.wallDiveEvery / g.rp.dive);
  }

  /** The arch: from both edges up to an apex over the centre. */
  private buildField(): void {
    const f = SHIELD_WALL.field;
    const half = (f.x1 - f.x0) / 2;
    const cx = (f.x0 + f.x1) / 2;
    this.fieldTop = f.apexY;
    this.fieldBottom = f.footY + f.thickness;
    for (let x = f.x0; x <= f.x1; x++) {
      const u = (x - cx) / half;
      const y0 = Math.round(f.apexY + u * u * (f.footY - f.apexY));
      for (let t = 0; t < f.thickness; t++) this.field[(y0 + t) * FB_W + x] = 1;
    }
  }

  fieldAt(x: number, y: number): boolean {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= FB_W || y < 0 || y >= FB_H) return false;
    return this.field[y * FB_W + x] === 1;
  }

  /** Erase a ragged crater. Deterministic (uses the game RNG). */
  crater(g: Game, cx: number, cy: number, r: number): void {
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > r * r) continue;
        // Ragged rim: the outer pixels go only some of the time.
        if (d2 > (r - 1) * (r - 1) && g.rng.chance(0.45)) continue;
        const x = Math.round(cx) + dx;
        const y = Math.round(cy) + dy;
        if (x >= 0 && x < FB_W && y >= 0 && y < FB_H) this.field[y * FB_W + x] = 0;
      }
    }
  }

  fieldPixels(): number {
    let n = 0;
    for (let i = 0; i < this.field.length; i++) n += this.field[i];
    return n;
  }

  formation(g: Game): Enemy[] {
    return g.enemies.filter((e) => e.alive && e.state === 'formation');
  }

  update(g: Game): void {
    this.march(g);
    this.peelOff(g);
    for (const e of g.enemies) {
      if (!e.alive || e.type !== 'drone') continue;
      e.t++;
      if (e.state !== 'formation') this.updateDiver(g, e);
    }
  }

  private march(g: Game): void {
    if (--this.marchT > 0) return;
    const alive = g.enemies.filter((e) => e.alive && e.type === 'drone').length;
    const frac = this.total > 1 ? (alive - 1) / (this.total - 1) : 0;
    // The block speeds up as it thins; the last fighter is quick.
    this.marchT = Math.max(1, Math.round(lerp(TUNING.wallTickFast, TUNING.wallTickSlow, frac) / g.rp.speed));
    const form = this.formation(g);
    const step = TUNING.wallStepX * this.dir;
    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const e of form) {
      minX = Math.min(minX, e.x);
      maxX = Math.max(maxX, e.x);
      maxY = Math.max(maxY, e.y);
    }
    // Divers count too: the block keeps its shape.
    if (form.length === 0) {
      this.originX += step;
      if (this.originX < 4 || this.originX + this.blockWidth > FB_W - 4) this.dir = -this.dir;
    } else if (minX + step < 8 || maxX + step > FB_W - 8) {
      this.dir = -this.dir;
      if (maxY + TUNING.wallStepDown <= TUNING.wallFloor) this.originY += TUNING.wallStepDown;
    } else {
      this.originX += step;
    }
    this.anim ^= 1;
    for (const e of form) {
      e.x = this.originX + e.hx;
      e.y = this.originY + e.hy;
    }
    g.pulse();
    this.bombs(g, form);
  }

  private bombs(g: Game, form: Enemy[]): void {
    // Only the lowest fighter in each column may bomb.
    const lowest = new Map<number, Enemy>();
    for (const e of form) {
      const cur = lowest.get(e.hx);
      if (!cur || e.hy > cur.hy) lowest.set(e.hx, e);
    }
    const chance = TUNING.wallBombChance * g.rp.fire * (1 + (1 - form.length / Math.max(1, this.total)));
    for (const e of lowest.values()) {
      if (g.rng.chance(chance)) g.dropBomb(e.x, e.y + 5);
    }
  }

  private peelOff(g: Game): void {
    if (--this.diveT > 0) return;
    this.diveT = Math.round((TUNING.wallDiveEvery / g.rp.dive) * g.rng.range(0.7, 1.3));
    const diving = g.enemies.filter((e) => e.alive && e.type === 'drone' && e.state !== 'formation').length;
    if (diving >= byRank(SHIELD_WALL.maxDivers, g.level)) return;
    const form = this.formation(g);
    if (form.length < 2) return;
    // Prefer fighters on the block's edges: they have room to swing out.
    const e = g.rng.pick(form);
    g.setState(e, 'leaving');
    e.p0 = e.x < FB_W / 2 ? -1 : 1; // swing direction
    e.p1 = e.x;
    e.p2 = e.y;
  }

  private updateDiver(g: Game, e: Enemy): void {
    const sp = TUNING.diverSpeed * g.rp.speed;
    switch (e.state) {
      case 'leaving': {
        // Swing out and up in a half loop, then commit.
        const pt = SHIELD_WALL.pattern;
        const k = e.t / pt.swingFrames;
        e.x = e.p1 + e.p0 * pt.swingOut * Math.min(1, k * 1.4);
        e.y = e.p2 - pt.swingRise * (k < 0.5 ? k * 2 : 2 - k * 2);
        if (e.t >= pt.swingFrames) {
          g.setState(e, 'attacking');
          // Aim for the field above the player, or the player through a gap.
          e.p1 = clamp(g.player.x + g.rng.range(-pt.aimSpread, pt.aimSpread), 12, FB_W - 12);
        }
        break;
      }
      case 'attacking': {
        const dx = e.p1 - e.x;
        const pt = SHIELD_WALL.pattern;
        e.vx = clamp(dx * pt.steer, -pt.maxDrift, pt.maxDrift);
        e.vy = sp;
        e.x += e.vx;
        e.y += e.vy;
        if (e.t % pt.bombEvery === pt.bombEvery >> 1 && g.rng.chance(0.5 * g.rp.fire)) g.dropBomb(e.x, e.y + 5);
        // Diving into the force field blows a big hole and the fighter.
        if (this.fieldNear(e.x, e.y + 4, 3)) {
          this.crater(g, e.x, e.y + 4, pt.craterDiver);
          g.sfx('fizz');
          g.killEnemy(e, false);
          return;
        }
        if (e.y > FB_H + 8) {
          g.setState(e, 'returning');
          e.y = -10;
        }
        break;
      }
      case 'returning': {
        const tx = this.originX + e.hx;
        const ty = this.originY + e.hy;
        const dx = tx - e.x;
        const dy = ty - e.y;
        const d = Math.hypot(dx, dy);
        if (d < sp * 1.5) {
          e.x = tx;
          e.y = ty;
          g.setState(e, 'formation');
        } else {
          e.x += (dx / d) * sp * SHIELD_WALL.pattern.returnBoost;
          e.y += (dy / d) * sp * SHIELD_WALL.pattern.returnBoost;
        }
        break;
      }
      default:
        break;
    }
  }

  private fieldNear(x: number, y: number, r: number): boolean {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -r; dx <= r; dx++) if (this.fieldAt(x + dx, y + dy)) return true;
    return false;
  }

  shotScenery(g: Game, x: number, y: number): boolean {
    if (y < this.fieldTop - 1 || y > this.fieldBottom + 1) return false;
    if (!this.fieldAt(x, y)) return false;
    // Your own shot eats a small hole: the price of firing from cover.
    this.crater(g, x, y, SHIELD_WALL.pattern.craterShot);
    g.sfx('fizz');
    return true;
  }

  bulletScenery(g: Game, b: Bullet): boolean {
    const tip = b.y + 2;
    if (tip < this.fieldTop - 1 || tip > this.fieldBottom + 1) return false;
    if (!this.fieldAt(b.x, tip)) return false;
    this.crater(g, b.x, tip, SHIELD_WALL.pattern.craterBomb);
    g.sfx('fizz');
    return true;
  }

  isClear(g: Game): boolean {
    return !g.enemies.some((e) => e.alive && e.type === 'drone');
  }

  remaining(g: Game): number {
    return g.enemies.filter((e) => e.alive && e.type === 'drone').length / Math.max(1, this.total);
  }
}
