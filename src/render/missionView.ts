import { FB_W, type Framebuffer } from './framebuffer';
import { PEN } from '../palette';
import type { Game } from '../game/game';
import type { ShieldWall } from '../game/missions/shieldWall';

/** Mission scenery drawn behind the enemies (force field, vortex). */
export function drawMissionBack(fb: Framebuffer, g: Game, _frame: number): void {
  switch (g.mission.id) {
    case 'shieldWall':
      drawField(fb, g.mission as ShieldWall);
      break;
    default:
      break;
  }
}

/** Mission scenery drawn over the enemies (beams, hull, reactor). */
export function drawMissionFront(_fb: Framebuffer, _g: Game, _frame: number): void {}

function drawField(fb: Framebuffer, m: ShieldWall): void {
  const f = m.field;
  for (let y = m.fieldTop; y <= m.fieldBottom; y++) {
    const row = y * FB_W;
    for (let x = 0; x < FB_W; x++) if (f[row + x]) fb.px[row + x] = PEN.FIELD;
  }
}
