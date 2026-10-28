import { FB_W, FB_H, type Framebuffer } from './framebuffer';
import { PEN } from '../palette';
import type { Game } from '../game/game';
import type { ShieldWall } from '../game/missions/shieldWall';
import type { LaserAttack } from '../game/missions/laserAttack';

/** Mission scenery drawn behind the enemies (force field, vortex). */
export function drawMissionBack(fb: Framebuffer, g: Game, frame: number): void {
  switch (g.mission.id) {
    case 'shieldWall':
      drawField(fb, g.mission as ShieldWall);
      break;
    case 'laserAttack':
      drawLasers(fb, g, g.mission as LaserAttack, frame);
      break;
    default:
      break;
  }
}

/** Mission scenery drawn over the enemies (hull, reactor). */
export function drawMissionFront(_fb: Framebuffer, _g: Game, _frame: number): void {}

function drawField(fb: Framebuffer, m: ShieldWall): void {
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
      // Final third: a dotted line shows exactly where the beam will fall.
      if (k > 0.6) {
        for (let y = ey + 4 + ((frame >> 1) % 6); y < FB_H - 12; y += 6) fb.pset(ex, y, PEN.BEAM);
      }
    } else if (c.state === 'firing') {
      const b = m.beamRect(c);
      const flicker = (frame & 1) as number;
      fb.rect(b.x0 + flicker * 0.5, b.y0, b.x1 - b.x0, b.y1 - b.y0, PEN.BEAM);
      fb.rect(ex, b.y0, 1, b.y1 - b.y0, PEN.WHITE);
      // Splash where it hits the ground.
      for (let i = 0; i < 6; i++) fb.pset(ex - 5 + ((i * 7 + frame) % 11), FB_H - 14 - ((i * 3 + frame) % 4), PEN.CYC0 + i);
    }
  }
}
