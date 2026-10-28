import { FB_W, FB_H, type Framebuffer } from './framebuffer';
import { PEN } from '../palette';
import { TUNING } from '../tuning';
import { FLAGSHIP } from '../content/sprites';
import { SPACE_WARP } from '../content/missions';
import type { Game } from '../game/game';
import type { ShieldWall } from '../game/missions/shieldWall';
import type { LaserAttack } from '../game/missions/laserAttack';
import type { SpaceWarp } from '../game/missions/spaceWarp';
import type { Flagship } from '../game/missions/flagship';

/** Mission scenery drawn behind the enemies (force field, vortex). */
export function drawMissionBack(fb: Framebuffer, g: Game, frame: number): void {
  switch (g.mission.id) {
    case 'shieldWall':
      drawField(fb, g.mission as ShieldWall);
      break;
    case 'laserAttack':
      drawLasers(fb, g, g.mission as LaserAttack, frame);
      break;
    case 'spaceWarp':
      drawVortex(fb, g.mission as SpaceWarp, frame);
      break;
    default:
      break;
  }
}

/** Mission scenery drawn over the enemies (hull, reactor). */
export function drawMissionFront(fb: Framebuffer, g: Game, frame: number): void {
  if (g.mission.id === 'flagship') drawFlagship(fb, g, g.mission as Flagship, frame);
}

function drawField(fb: Framebuffer, m: ShieldWall): void {
  if (!m.fieldUp) return; // switched off while your shot goes out
  const f = m.field;
  for (let y = m.fieldTop; y <= m.fieldBottom; y++) {
    const row = y * FB_W;
    for (let x = 0; x < FB_W; x++) if (f[row + x]) fb.px[row + x] = PEN.FIELD;
  }
}

function drawLasers(fb: Framebuffer, g: Game, m: LaserAttack, frame: number): void {
  for (const c of m.carriers(g)) {
    const ex = Math.round(c.x);
    const ey = Math.round(c.y + 5);
    if (c.state === 'charging') {
      const k = c.t / Math.max(1, c.p0);
      // A growing, colour-cycling glow at the emitter.
      const r = 1 + k * 4 + ((frame >> 2) & 1);
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2 + frame * 0.2;
        fb.pset(ex + Math.cos(ang) * r, ey + Math.sin(ang) * r, PEN.CYC0 + (a % 6));
      }
      fb.rect(ex - 1, ey - 1, 3, 3, k > 0.6 && frame & 2 ? PEN.WHITE : PEN.BEAM);
      // Final stretch: a dotted line shows exactly where the beam will fall.
      if (k > 0.6) {
        for (let y = ey + 4 + ((frame >> 1) % 6); y < FB_H - 12; y += 6) fb.pset(ex, y, PEN.BEAM);
      }
    } else if (c.state === 'firing') {
      const b = m.beamRect(c);
      const flicker = (frame & 1) as number;
      fb.rect(b.x0 + flicker * 0.5, b.y0, b.x1 - b.x0, b.y1 - b.y0, PEN.BEAM);
      fb.rect(ex, b.y0, 1, b.y1 - b.y0, PEN.WHITE);
      for (let i = 0; i < 6; i++) fb.pset(ex - 5 + ((i * 7 + frame) % 11), FB_H - 14 - ((i * 3 + frame) % 4), PEN.CYC0 + i);
    }
  }
}

/**
 * The vortex: spiral arms painted once with the six cycling pens; the
 * palette rotates every few frames so the arms appear to turn and pour.
 */
let vortexCache: { x: number; y: number; pen: number }[] | null = null;
function vortexPixels(): { x: number; y: number; pen: number }[] {
  if (vortexCache) return vortexCache;
  const out: { x: number; y: number; pen: number }[] = [];
  const R = SPACE_WARP.vortexRadius;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy / 0.92);
      if (d > R || d < 1.5) continue;
      const a = Math.atan2(dy, dx);
      // Three arms, twisting with distance.
      const arm = (((a / (Math.PI * 2)) * 3 + d / 9) % 1 + 1) % 1;
      if (arm > 0.55) continue;
      // Thin out toward the rim with an ordered dither.
      const keep = (d / R) * 4 < 1 + ((dx * 3 + dy * 5) & 3);
      if (!keep) continue;
      out.push({ x: dx, y: dy, pen: PEN.CYC0 + (Math.floor(d / 4 + arm * 6) % 6) });
    }
  }
  vortexCache = out;
  return out;
}

function drawVortex(fb: Framebuffer, m: SpaceWarp, frame: number): void {
  for (const p of vortexPixels()) fb.pset(m.cx + p.x, m.cy + p.y, p.pen);
  // A bright, pulsing eye.
  const r = 2 + ((frame >> 3) & 1);
  fb.rect(m.cx - r, m.cy - r, r * 2 + 1, r * 2 + 1, PEN.CYC0 + ((frame >> 2) % 6));
  fb.pset(m.cx, m.cy, PEN.WHITE);
}

function drawFlagship(fb: Framebuffer, g: Game, m: Flagship, frame: number): void {
  // Gone in the final stage of the explosion.
  if (g.phase === 'boom' && g.phaseT >= 170) return;
  const shake = g.phase === 'boom' ? ((g.phaseT * 7) % 5) - 2 : 0;
  const cx = m.x + shake;
  fb.sprite(FLAGSHIP, frame >> 4, cx, m.y, [PEN.EC1, PEN.EC2, PEN.EC3]);
  // The reactor glows and cycles in its notch.
  const rr = m.reactorRect();
  for (let x = rr.x0; x <= rr.x1; x++) {
    for (let y = rr.y0; y < rr.y1; y++) fb.pset(x + shake, y, PEN.CYC0 + ((x + y + (frame >> 1)) % 6));
  }
  // Hull blocks, banded per row by the per-scanline gradient.
  const bw = TUNING.hullBlockW;
  const bh = TUNING.hullBlockH;
  const hl = m.hullLeft + shake;
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) {
      if (!m.blockAt(c, r)) continue;
      fb.rect(hl + c * bw, m.hullTop + r * bh, bw - 1, bh - 1, PEN.FIELD);
    }
  }
}
