import { FB_H, FB_W, Framebuffer, wrapText } from './framebuffer';
import { PEN, col } from '../palette';
import { TUNING } from '../tuning';
import { ENEMY_TYPES } from '../content/enemies';
import { BOMB, LIFE_ICON, PLAYER, VORG_FACE, VORG_MOUTH, VORG_MOUTH_AT } from '../content/sprites';
import { LOOKS, type Look } from '../content/looks';
import { rankLabel, RANKS, rankIndex } from '../content/ranks';
import { MISSIONS } from '../content/missions';
import type { ColourOverrides } from './colours';
import { Rng } from '../core/rng';
import type { Game } from '../game/game';
import type { Enemy } from '../game/types';
import { mouthTrack, parsePhonemes } from '../audio/phonemes';
import { drawMissionBack, drawMissionFront } from './missionView';

interface Star { x: number; y: number; v: number; pen: number }

/** Scrolling starfield (cosmetic, not part of the simulation). */
export class Starfield {
  stars: Star[] = [];
  constructor(n = 70, seed = 4242) {
    const r = new Rng(seed);
    for (let i = 0; i < n; i++) {
      const layer = r.int(3);
      this.stars.push({ x: r.int(FB_W), y: r.int(FB_H), v: 0.08 + layer * 0.12, pen: PEN.STAR1 + layer });
    }
  }
  update(speed = 1): void {
    for (const s of this.stars) {
      s.y += s.v * speed;
      if (s.y >= FB_H) s.y -= FB_H;
    }
  }
  draw(fb: Framebuffer, frame: number): void {
    for (const s of this.stars) {
      // Twinkle: brightest stars blink now and then.
      if (s.pen === PEN.STAR3 && ((frame + s.x * 7) % 90) < 6) continue;
      fb.pset(s.x, s.y, s.pen);
    }
  }
}

const mouthCache = new Map<string, Uint8Array>();
export function mouthFor(ph: string, framesIn: number): number {
  let m = mouthCache.get(ph);
  if (!m) {
    m = mouthTrack(parsePhonemes(ph));
    mouthCache.set(ph, m);
  }
  return framesIn >= 0 && framesIn < m.length ? m[framesIn] : 0;
}

export const FACE_PENS = [PEN.FACE, PEN.EC2, PEN.HUD2, PEN.CYC0, PEN.EC1, PEN.BLACK];

/** VORG's face with its mouth set to 0 (shut), 1 or 2 (open). */
export function drawVorgFace(fb: Framebuffer, cx: number, cy: number, mouth: number, scale = 1): void {
  fb.sprite(VORG_FACE, 0, cx, cy, FACE_PENS, scale);
  const w = VORG_FACE.frames[0][0].length;
  const h = VORG_FACE.frames[0].length;
  const mw = VORG_MOUTH.frames[0][0].length;
  const mh = VORG_MOUTH.frames[0].length;
  const ox = Math.round(cx - (w * scale) / 2) + VORG_MOUTH_AT.x * scale;
  const oy = Math.round(cy - (h * scale) / 2) + VORG_MOUTH_AT.y * scale;
  fb.sprite(VORG_MOUTH, mouth, ox + (mw * scale) / 2, oy + (mh * scale) / 2, FACE_PENS, scale);
}

export function pad(n: number, w = 6): string {
  return String(Math.max(0, Math.floor(n))).padStart(w, '0');
}

/** Pens for an enemy sprite (white while flashing from a hit). */
function enemyPens(e: Enemy): number[] {
  const def = ENEMY_TYPES[e.type] as { pens: string[]; attackPens?: string[] };
  if (e.flash > 0 && (e.flash & 2)) return [PEN.WHITE, PEN.WHITE, PEN.WHITE];
  const names = def.attackPens && e.state !== 'formation' ? def.attackPens : def.pens;
  return names.map((n) => PEN[n as keyof typeof PEN]);
}

export function enemyFrame(e: Enemy, frame: number, wallAnim: number): number {
  const def = ENEMY_TYPES[e.type];
  if (def.anim === 0) return wallAnim;
  return Math.floor((frame + e.id * 3) / def.anim);
}

export function drawEnemy(fb: Framebuffer, e: Enemy, frame: number, wallAnim = 0): void {
  const def = ENEMY_TYPES[e.type];
  const spr = def.sprites[Math.min(e.stage, def.sprites.length - 1)];
  fb.sprite(spr, enemyFrame(e, frame, wallAnim), e.x, e.y, enemyPens(e));
}

export interface HudInfo {
  hiScore: number;
  showPause: boolean;
}

export function drawHud(fb: Framebuffer, g: Game, hud: HudInfo): void {
  fb.rect(0, 0, FB_W, TUNING.hudTop - 2, PEN.BLACK);
  fb.text('SCORE', 4, 1, PEN.HUD1, 'small');
  fb.text(pad(g.score), 4, 8, PEN.WHITE);
  fb.textCentered('HI', 102, 1, PEN.HUD1, 'small');
  fb.textCentered(pad(Math.max(hud.hiScore, g.continued ? 0 : g.score)), 102, 8, PEN.HUD2);
  if (hud.showPause) {
    // Pause button: two bars in a box, top right.
    fb.frame(188, 2, 13, 13, PEN.HUD1);
    fb.rect(192, 5, 2, 7, PEN.WHITE);
    fb.rect(196, 5, 2, 7, PEN.WHITE);
  }
  const by = FB_H - TUNING.hudBottom;
  fb.rect(0, by, FB_W, TUNING.hudBottom, PEN.BLACK);
  const shown = Math.min(Math.max(0, g.lives - (g.player.alive ? 1 : 0)), 6);
  for (let i = 0; i < shown; i++) fb.sprite(LIFE_ICON, 0, 8 + i * 10, by + 6, [PEN.PLAYER, PEN.PLAYER2]);
  if (g.lives - 1 > 6) fb.text(`+${g.lives - 7}`, 68, by + 3, PEN.WHITE, 'small');
  const r = rankLabel(g.level, true);
  const w = r.length * 4;
  fb.text(r, FB_W - 4 - w, by + 4, PEN.HUD2, 'small');
}

/** VORG's subtitle: a message band under the score while a line plays. */
export function drawSubtitle(fb: Framebuffer, text: string, y: number = TUNING.hudTop): void {
  const lines = wrapText(text, FB_W - 12);
  const h = lines.length * 9 + 3;
  fb.rect(0, y, FB_W, h, PEN.BLACK);
  lines.forEach((l, i) => fb.textCentered(l, FB_W / 2, y + 2 + i * 9, PEN.HUD2));
}

/** Draw the whole game at its current phase. Returns the look to colour it with. */
export function drawGame(fb: Framebuffer, g: Game, stars: Starfield, frame: number, hud: HudInfo, subtitles: boolean): { look: Look; ov: ColourOverrides } {
  fb.clear(PEN.BLACK);
  const ov: ColourOverrides = {};
  if (g.flash > 0) ov.flash = g.flashColour;
  stars.draw(fb, frame);
  if (g.phase === 'card') {
    drawCard(fb, g, frame);
    if (subtitles) drawSpeech(fb, g, true);
    drawHud(fb, g, hud);
    return { look: LOOKS.card, ov };
  }
  if (g.phase === 'promotion') {
    drawPromotion(fb, g, frame);
    if (subtitles) drawSpeech(fb, g, true);
    drawHud(fb, g, hud);
    return { look: LOOKS.card, ov };
  }

  drawMissionBack(fb, g, frame);
  for (const e of g.enemies) if (e.alive) drawEnemy(fb, e, frame, missionAnim(g));
  drawMissionFront(fb, g, frame);

  // Enemy fire.
  for (const b of g.bullets) {
    if (b.type === 'bomb') fb.sprite(BOMB, frame >> 3, b.x, b.y, [PEN.BOMB, PEN.WHITE]);
    else {
      fb.rect(b.x, b.y - 2, 1, 4, PEN.DART);
      fb.pset(b.x, b.y + 2, PEN.WHITE);
    }
  }

  // The player and the quantum shot.
  const p = g.player;
  if (p.alive && !(p.invuln > 0 && (frame & 4))) {
    fb.sprite(PLAYER, frame >> 2, p.x, p.y, [PEN.PLAYER, PEN.PLAYER2, PEN.PLAYER3]);
  }
  if (g.shot.alive) {
    fb.rect(g.shot.x, g.shot.y, 1, TUNING.shotLength, PEN.SHOT);
    fb.pset(g.shot.x, g.shot.y, PEN.WHITE);
  }

  drawParticles(fb, g, frame);
  drawHud(fb, g, hud);

  if (g.phase === 'clear') {
    fb.textCentered('MISSION', FB_W / 2, 120, PEN.HUD2, 'big', 2);
    fb.textCentered('COMPLETE', FB_W / 2, 140, PEN.HUD2, 'big', 2);
  } else if (g.phase === 'over' || g.phase === 'done') {
    if (g.opts.mode !== 'demo') {
      fb.rect(30, 126, FB_W - 60, 30, PEN.BLACK);
      fb.textCentered('GAME OVER', FB_W / 2, 134, PEN.HUD1, 'big', 2);
    }
  } else if (g.phase === 'dying' && g.lives > 0 && g.phaseT > 50) {
    fb.textCentered('READY', FB_W / 2, 200, PEN.WHITE);
  }
  if (subtitles) drawSpeech(fb, g, false);
  const look = LOOKS[MISSIONS[g.missionIndex].look];
  return { look, ov };
}

function missionAnim(g: Game): number {
  const m = g.mission as unknown as { anim?: number };
  return m.anim ?? 0;
}

function drawSpeech(fb: Framebuffer, g: Game, onCard: boolean): void {
  const cur = g.vorg.current;
  if (!cur) return;
  if (onCard) return; // the card shows the line itself
  drawSubtitle(fb, cur.text);
}

function drawParticles(fb: Framebuffer, g: Game, frame: number): void {
  for (const p of g.particles) {
    switch (p.kind) {
      case 'spark': {
        const pen = PEN.CYC0 + ((p.max - p.life + (p.pen ?? 0)) % 6);
        fb.pset(p.x, p.y, pen);
        if (p.life > p.max * 0.6) fb.pset(p.x + 1, p.y, pen);
        break;
      }
      case 'ring': {
        const pen = PEN.CYC0 + ((frame >> 1) % 6);
        const n = Math.max(12, Math.round(p.r * 5));
        for (let i = 0; i < n; i++) {
          if ((i + (frame >> 2)) % 3 === 0) continue;
          const a = (i / n) * Math.PI * 2;
          fb.pset(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r, pen);
        }
        break;
      }
      case 'pop': {
        const r = Math.round(p.r);
        fb.pset(p.x, p.y, PEN.WHITE);
        fb.pset(p.x - r, p.y, PEN.SHOT);
        fb.pset(p.x + r, p.y, PEN.SHOT);
        fb.pset(p.x, p.y - r, PEN.SHOT);
        fb.pset(p.x, p.y + r, PEN.SHOT);
        break;
      }
      case 'text':
        if (p.text) fb.textCentered(p.text, p.x, Math.round(p.y), p.life & 4 ? PEN.WHITE : PEN.HUD2, 'small');
        break;
      case 'debris':
        fb.pset(p.x, p.y, PEN.PLAYER);
        break;
    }
  }
}

function drawCard(fb: Framebuffer, g: Game, frame: number): void {
  const m = MISSIONS[g.missionIndex];
  fb.textCentered(`MISSION ${g.missionIndex + 1}`, FB_W / 2, 44, PEN.HUD1);
  const nameScale = m.name.length > 10 ? 2 : 3;
  fb.textCentered(m.name, FB_W / 2, 62, PEN.HUD2, 'big', nameScale);
  const cur = g.vorg.current;
  const mouth = cur ? mouthFor(cur.ph, g.frame - cur.start) : 0;
  drawVorgFace(fb, FB_W / 2, 150, mouth, 2);
  if (cur) {
    const lines = wrapText(cur.text, FB_W - 16);
    lines.forEach((l, i) => fb.textCentered(l, FB_W / 2, 196 + i * 10, PEN.WHITE));
  }
  fb.textCentered('NEXT RANK', FB_W / 2, 238, PEN.HUD1, 'small');
  const next = g.missionIndex === 4 ? rankLabel(g.level + 1) : rankLabel(g.level + 1);
  fb.textCentered(next, FB_W / 2, 247, PEN.WHITE);
  const diff = g.difficulty === 'normal' ? '' : `  ${g.difficulty.toUpperCase()}`;
  fb.textCentered(`RANK: ${rankLabel(g.level, true)}${diff}`, FB_W / 2, 266, PEN.HUD1, 'small');
  if (g.phaseT >= TUNING.cardSkipAfter && (frame & 32)) fb.textCentered('FIRE TO SKIP', FB_W / 2, 284, PEN.STAR2, 'small');
}

function drawPromotion(fb: Framebuffer, g: Game, frame: number): void {
  fb.textCentered('PROMOTED', FB_W / 2, 50, PEN.HUD2, 'big', 2);
  const r = RANKS[rankIndex(g.level)];
  const label = rankLabel(g.level);
  fb.textCentered('QUANTUM', FB_W / 2, 82, PEN.WHITE);
  fb.textCentered(label.replace('QUANTUM ', ''), FB_W / 2, 94, frame & 8 ? PEN.HUD2 : PEN.WHITE, 'big', label.length > 18 ? 1 : 2);
  void r;
  const cur = g.vorg.current;
  const mouth = cur ? mouthFor(cur.ph, g.frame - cur.start) : 0;
  drawVorgFace(fb, FB_W / 2, 170, mouth, 2);
  if (cur) wrapText(cur.text, FB_W - 16).forEach((l, i) => fb.textCentered(l, FB_W / 2, 216 + i * 10, PEN.WHITE));
}

export { col };
